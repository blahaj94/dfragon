import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { BrowserWindowConstructorOptions } from 'electron'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readDesktopChannel } from '../../build/channels'

const mocks = vi.hoisted(() => {
  const constructWindow = vi.fn()
  const loadURL = vi.fn()
  const loadFile = vi.fn()
  const registerWindow = vi.fn()
  const permissionCheck = vi.fn()
  const permissionRequest = vi.fn()
  const disposeCapture = vi.fn()
  const registerCapture = vi.fn(() => disposeCapture)
  const registerDiagnosticsWindow = vi.fn(() => vi.fn())
  const registerWindowChromeWindow = vi.fn<
    typeof import('./window-chrome/ipc-handler').registerWindowChromeWindow
  >(() => vi.fn())
  const disposeMainDiagnostics = vi.fn()
  const registerMainDiagnosticErrors = vi.fn(() => disposeMainDiagnostics)
  const reportDiagnostic = vi.fn()
  const registerDesktopShortcuts = vi.fn(() => vi.fn())
  const updateNotices = {
    start: vi.fn(),
    snapshot: vi.fn(),
    subscribe: vi.fn(),
    dismiss: vi.fn(),
    dispose: vi.fn()
  }
  const createUpdateNotices = vi.fn<typeof import('./update-notice/notices').createUpdateNotices>(
    () => updateNotices
  )
  const registerUpdateNoticeWindow = vi.fn<
    typeof import('./update-notice/ipc-handler').registerUpdateNoticeWindow
  >(() => vi.fn())
  const readReleaseFeed = vi.fn<typeof import('./update-notice/http').readReleaseFeed>()
  const requestSingleInstanceLock = vi.fn(() => true)
  const quit = vi.fn()
  const setPath = vi.fn()
  const getPath = vi.fn()
  const getVersion = vi.fn(() => '6.7.8')
  const setName = vi.fn()
  const setAppUserModelId = vi.fn()
  const exit = vi.fn()
  const appOn = vi.fn()
  const windows = [] as unknown[]

  return {
    constructWindow,
    loadURL,
    loadFile,
    registerWindow,
    permissionCheck,
    permissionRequest,
    registerCapture,
    disposeCapture,
    registerDiagnosticsWindow,
    registerWindowChromeWindow,
    registerMainDiagnosticErrors,
    disposeMainDiagnostics,
    reportDiagnostic,
    registerDesktopShortcuts,
    updateNotices,
    createUpdateNotices,
    registerUpdateNoticeWindow,
    readReleaseFeed,
    bootstrap: undefined as Promise<void> | undefined,
    requestSingleInstanceLock,
    quit,
    setPath,
    getPath,
    getVersion,
    setName,
    setAppUserModelId,
    exit,
    appOn,
    windows
  }
})
vi.mock('electron', () => {
  const session = {
    defaultSession: {
      setPermissionCheckHandler: mocks.permissionCheck,
      setPermissionRequestHandler: mocks.permissionRequest
    }
  }
  const app = {
    whenReady: () => ({
      // biome-ignore lint/suspicious/noThenProperty: Electron whenReady()가 돌려주는 thenable을 흉내 낸다.
      then: (callback: () => void | Promise<void>): Promise<void> => {
        mocks.bootstrap = Promise.resolve().then(callback)

        return mocks.bootstrap.catch(() => undefined)
      }
    }),
    on: mocks.appOn,
    requestSingleInstanceLock: mocks.requestSingleInstanceLock,
    setPath: mocks.setPath,
    getPath: mocks.getPath,
    getVersion: mocks.getVersion,
    setName: mocks.setName,
    setAppUserModelId: mocks.setAppUserModelId,
    exit: mocks.exit,
    quit: mocks.quit
  }
  class BrowserWindow {
    static getAllWindows = vi.fn(() => mocks.windows)

    constructor(options: BrowserWindowConstructorOptions) {
      mocks.constructWindow(options)
      mocks.windows.push(this)
    }
    isDestroyed = vi.fn(() => false)
    on = vi.fn()
    webContents = {
      mainFrame: { url: '', detached: false, isDestroyed: vi.fn(() => false) },
      isDestroyed: vi.fn(() => false),
      setWindowOpenHandler: vi.fn(),
      on: vi.fn()
    }
    loadURL = mocks.loadURL
    loadFile = mocks.loadFile
    isMinimized = vi.fn(() => false)
    restore = vi.fn()
    show = vi.fn()
    focus = vi.fn()
    destroy = vi.fn()
  }

  return { session, app, BrowserWindow }
})
vi.mock('@electron-toolkit/utils', () => {
  const optimizer = { watchWindowShortcuts: vi.fn() }

  return { optimizer, is: { dev: true } }
})
vi.mock('./capture/ipc-handler', () => ({
  registerCaptureIpc: mocks.registerCapture,
  registerCaptureWindow: mocks.registerWindow
}))
vi.mock('./shortcuts/register', () => ({
  registerDesktopShortcuts: mocks.registerDesktopShortcuts
}))
vi.mock('./update-notice/notices', () => ({
  createUpdateNotices: mocks.createUpdateNotices
}))
vi.mock('./update-notice/http', () => ({
  readReleaseFeed: mocks.readReleaseFeed
}))
vi.mock('./update-notice/ipc-handler', () => ({
  registerUpdateNoticeWindow: mocks.registerUpdateNoticeWindow
}))
vi.mock('./diagnostics/ipc-handler', () => ({
  registerDiagnosticsWindow: mocks.registerDiagnosticsWindow
}))
vi.mock('./window-chrome/ipc-handler', () => ({
  registerWindowChromeWindow: mocks.registerWindowChromeWindow
}))
vi.mock('./diagnostics/log', () => ({
  registerMainDiagnosticErrors: mocks.registerMainDiagnosticErrors,
  reportDiagnostic: mocks.reportDiagnostic
}))

type TestWindow = {
  on: ReturnType<typeof vi.fn>
  isMinimized: ReturnType<typeof vi.fn>
  restore: ReturnType<typeof vi.fn>
  show: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
}

function appListener(event: string): (...args: unknown[]) => void {
  const registration = mocks.appOn.mock.calls.find(([name]) => name === event)
  expect(registration, `${event} listener`).toBeDefined()

  return registration![1] as (...args: unknown[]) => void
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.windows = []
  mocks.requestSingleInstanceLock.mockReturnValue(true)
  mocks.getPath.mockImplementation(() => join(process.cwd(), 'synthetic-app-data'))
  mocks.loadFile.mockResolvedValue(undefined)
  mocks.loadURL.mockResolvedValue(undefined)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it.each([
  ['development', 'dfragon.dev'],
  ['test', 'dfragon.test']
] as const)(
  '%s 채널은 자기 profile 폴더와 앱 식별자를 쓰고 한 인스턴스만 띄운다',
  async (channel, identity) => {
    vi.stubGlobal('__DFRAGON_CHANNEL__', readDesktopChannel(channel, {}))
    const appData = join(process.cwd(), 'synthetic-app-data')

    await import('./main')
    await mocks.bootstrap

    expect(mocks.setPath).toHaveBeenCalledExactlyOnceWith('userData', join(appData, identity))
    expect(mocks.setName).toHaveBeenCalledExactlyOnceWith(identity)
    expect(mocks.setAppUserModelId).toHaveBeenCalledExactlyOnceWith(identity)
    expect(mocks.requestSingleInstanceLock).toHaveBeenCalledExactlyOnceWith()
    expect(mocks.constructWindow).toHaveBeenCalledOnce()
  }
)

it('채널 없는 개발 실행은 profile과 단일 인스턴스를 바꾸지 않는다', async () => {
  await import('./main')
  await mocks.bootstrap

  expect(mocks.setPath).not.toHaveBeenCalled()
  expect(mocks.requestSingleInstanceLock).not.toHaveBeenCalled()
  expect(mocks.constructWindow).toHaveBeenCalledOnce()
})

it('같은 채널의 두 번째 인스턴스는 IPC와 창을 만들지 않고 종료한다', async () => {
  vi.stubGlobal('__DFRAGON_CHANNEL__', readDesktopChannel('test', {}))
  mocks.requestSingleInstanceLock.mockReturnValue(false)

  await import('./main')
  await mocks.bootstrap

  expect(mocks.quit).toHaveBeenCalledOnce()
  expect(mocks.registerCapture).not.toHaveBeenCalled()
  expect(mocks.constructWindow).not.toHaveBeenCalled()
})

it('profile 적용이 실패하면 nonzero로 종료한다', async () => {
  vi.stubGlobal('__DFRAGON_CHANNEL__', readDesktopChannel('test', {}))
  mocks.setPath.mockImplementationOnce(() => {
    throw new Error('Synthetic profile failure')
  })

  await import('./main')

  expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1)
})

it.each([
  'https://example.test/',
  'data:text/html,synthetic',
  'javascript:void(0)',
  'http://synthetic@localhost:5173/',
  'http://localhost.example.test:5173/',
  'http://2130706433:5173/',
  'http://%6cocalhost:5173/',
  ' http://localhost:5173/'
])('local dev 경계를 벗어난 %s는 window 생성 전에 거절한다', async (url) => {
  vi.stubEnv('ELECTRON_RENDERER_URL', url)
  await import('./main')
  await expect(mocks.bootstrap).rejects.toThrow()
  expect(mocks.constructWindow).not.toHaveBeenCalled()
  expect(mocks.registerWindow).not.toHaveBeenCalled()
  expect(mocks.loadURL).not.toHaveBeenCalled()
})

it.each([
  ['http://localhost:5173', 'http://localhost:5173/'],
  ['http://127.0.0.1:5173/', 'http://127.0.0.1:5173/'],
  ['https://[::1]:5173/local.html', 'https://[::1]:5173/local.html']
])('검증한 local URL %s 하나만 등록하고 load한다', async (url, expected) => {
  vi.stubEnv('ELECTRON_RENDERER_URL', url)
  await import('./main')
  await mocks.bootstrap
  expect(mocks.loadURL).toHaveBeenCalledExactlyOnceWith(expected)
  expect(mocks.registerWindow).toHaveBeenCalledWith(expect.anything(), expected)
})

it('메인 창은 sandbox preload 하나만 쓰고 추가 인자를 넘기지 않는다', async () => {
  await import('./main')
  await mocks.bootstrap

  const { webPreferences } = mocks.constructWindow.mock
    .calls[0][0] as BrowserWindowConstructorOptions
  expect(webPreferences).toEqual({
    backgroundThrottling: false,
    preload: join(__dirname, '../preload/index.js'),
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false
  })
})

it('API 미구성이면 검색 설정 없이 캡처 IPC를 등록한다', async () => {
  await import('./main')
  await mocks.bootstrap

  expect(mocks.registerCapture).toHaveBeenCalledExactlyOnceWith(undefined)
})

it('API origin이 있으면 검색 시계, 얼굴 비교 정책과 점수 엔진을 캡처 IPC에 연결한다', async () => {
  vi.stubEnv('DFRAGON_API_ORIGIN', 'https://api.synthetic.test')
  await import('./main')
  await mocks.bootstrap

  expect(mocks.registerCapture).toHaveBeenCalledExactlyOnceWith({
    apiOrigin: 'https://api.synthetic.test',
    clock: expect.objectContaining({ read: expect.any(Function), schedule: expect.any(Function) }),
    portraitColorPolicy: expect.any(Object),
    score: expect.any(Function)
  })
  for (const [event, listener] of mocks.appOn.mock.calls) {
    if (event === 'quit') {
      ;(listener as () => void)()
    }
  }
  expect(mocks.disposeCapture).toHaveBeenCalledOnce()
})

it('기본 entry는 legacy를 포함한 media permission을 명시적으로 거절한다', async () => {
  vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173')
  await import('./main')
  await mocks.bootstrap
  expect(mocks.permissionCheck).toHaveBeenCalledOnce()
  expect(mocks.permissionRequest).toHaveBeenCalledOnce()
  const check = mocks.permissionCheck.mock.calls[0][0]
  const request = mocks.permissionRequest.mock.calls[0][0]
  expect(check(null, 'media', 'file://', { mediaType: 'unknown', isMainFrame: true })).toBe(false)
  const callback = vi.fn()
  request({}, 'media', callback, { mediaTypes: [], isMainFrame: true })
  expect(callback).toHaveBeenCalledExactlyOnceWith(false)
})

it('배포 채널만 새 버전 확인을 시작하고 앱 종료 때 정리한다', async () => {
  vi.stubGlobal(
    '__DFRAGON_CHANNEL__',
    readDesktopChannel('distribution', {
      DFRAGON_DISTRIBUTION_API_ORIGIN: 'https://api.synthetic.test'
    })
  )
  await import('./main')
  await mocks.bootstrap

  expect(mocks.createUpdateNotices).toHaveBeenCalledExactlyOnceWith({
    currentVersion: '6.7.8',
    readFeed: expect.any(Function),
    onFailure: mocks.reportDiagnostic
  })
  expect(mocks.updateNotices.start).toHaveBeenCalledOnce()
  // 피드는 cookie를 쓰지 않는 앱 API session으로 요청한다.
  const { fetchApi } = await import('./api-fetch')
  const signal = new AbortController().signal
  void mocks.createUpdateNotices.mock.calls[0][0].readFeed(signal)
  expect(mocks.readReleaseFeed).toHaveBeenCalledExactlyOnceWith(fetchApi, signal)
  for (const [event, listener] of mocks.appOn.mock.calls) {
    if (event === 'quit') {
      ;(listener as () => void)()
    }
  }
  expect(mocks.updateNotices.dispose).toHaveBeenCalledOnce()
  expect(mocks.registerUpdateNoticeWindow).toHaveBeenCalledExactlyOnceWith({
    window: mocks.windows[0],
    documentUrl: expect.stringContaining('/frontend/index.html'),
    notices: mocks.updateNotices,
    onFailure: mocks.reportDiagnostic
  })
})

it.each([
  { name: 'test 채널', channel: 'test' },
  { name: 'development 채널', channel: 'development' },
  { name: '채널 없는 실행', channel: null }
] as const)('$name은 새 버전을 확인하지 않고 알림 IPC만 연결한다', async ({ channel }) => {
  if (channel != null) {
    vi.stubGlobal('__DFRAGON_CHANNEL__', readDesktopChannel(channel, {}))
  }
  await import('./main')
  await mocks.bootstrap

  expect(mocks.updateNotices.start).not.toHaveBeenCalled()
  expect(mocks.registerUpdateNoticeWindow).toHaveBeenCalledOnce()
})

it.each([
  ['win32', { color: '#121214', symbolColor: '#f1ede6', height: 56 }],
  ['linux', { color: '#121214', symbolColor: '#f1ede6', height: 56 }],
  ['darwin', { height: 56 }]
] as const)(
  '%s에서 시스템 테마와 관계없이 다크 상단 바 색으로 제목 표시줄과 초기 창 색상을 설정한다',
  async (platform, titleBarOverlay) => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!
    Object.defineProperty(process, 'platform', { value: platform })
    try {
      await import('./main')
      await mocks.bootstrap

      expect(mocks.constructWindow).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          width: 1280,
          height: 800,
          minWidth: 1024,
          minHeight: 640,
          titleBarStyle: 'hidden',
          titleBarOverlay,
          backgroundColor: '#121214'
        })
      )
    } finally {
      Object.defineProperty(process, 'platform', originalPlatform)
    }
  }
)

it.each([undefined, 'http://localhost:5173'])(
  '메인 창과 정확한 문서 URL로 창 색상 IPC를 등록한다: %s',
  async (devUrl) => {
    vi.stubEnv('ELECTRON_RENDERER_URL', devUrl)
    await import('./main')
    await mocks.bootstrap
    const documentUrl =
      devUrl == null
        ? pathToFileURL(mocks.loadFile.mock.calls[0][0]).href
        : 'http://localhost:5173/'

    expect(mocks.registerWindowChromeWindow).toHaveBeenCalledExactlyOnceWith({
      window: mocks.windows[0],
      documentUrl
    })
  }
)

it('창 색상 IPC 등록 실패에도 캡처를 시작하고 창을 연다', async () => {
  mocks.registerWindowChromeWindow.mockImplementationOnce(() => {
    throw new Error('Synthetic window chrome registration failure')
  })
  await import('./main')
  await mocks.bootstrap
  const window = mocks.windows[0] as TestWindow
  const showWindow = window.on.mock.calls.find(
    ([event]) => event === 'ready-to-show'
  )![1] as () => void
  showWindow()

  expect(window.show).toHaveBeenCalledOnce()
  expect(mocks.registerCapture).toHaveBeenCalledOnce()
  expect(mocks.loadFile).toHaveBeenCalledOnce()
})

it('문서 load가 실패하면 진단 코드만 남긴다', async () => {
  mocks.loadFile.mockRejectedValueOnce(new Error('Synthetic load failure'))
  await import('./main')
  await mocks.bootstrap
  await vi.waitFor(() =>
    expect(mocks.reportDiagnostic).toHaveBeenCalledExactlyOnceWith('MAIN_PROCESS_FAILED')
  )
})

it('창 구성 후반이 실패하면 등록한 IPC와 만든 창을 폐기하고 다음 활성화에 다시 구성한다', async () => {
  vi.stubGlobal('__DFRAGON_CHANNEL__', readDesktopChannel('test', {}))
  await import('./main')
  await mocks.bootstrap
  const firstWindow = mocks.windows[0] as TestWindow
  const closeWindow = firstWindow.on.mock.calls.find(
    ([event]) => event === 'closed'
  )![1] as () => void
  closeWindow()
  mocks.windows = []

  const disposeWindowChrome = vi.fn()
  const disposeShortcuts = vi.fn()
  const disposeDiagnostics = vi.fn()
  const disposeUpdateNotice = vi.fn()
  mocks.registerWindowChromeWindow.mockReturnValueOnce(disposeWindowChrome)
  mocks.registerDesktopShortcuts.mockReturnValueOnce(disposeShortcuts)
  mocks.registerDiagnosticsWindow.mockReturnValueOnce(disposeDiagnostics)
  mocks.registerUpdateNoticeWindow.mockReturnValueOnce(disposeUpdateNotice)
  mocks.loadFile.mockImplementationOnce(() => {
    throw new Error('Synthetic late window composition failure')
  })
  const activate = appListener('second-instance')
  activate()
  const partialWindow = mocks.windows[0] as TestWindow

  expect(partialWindow.destroy).toHaveBeenCalledOnce()
  expect(partialWindow.show).not.toHaveBeenCalled()
  for (const dispose of [
    disposeWindowChrome,
    disposeShortcuts,
    disposeDiagnostics,
    disposeUpdateNotice
  ]) {
    expect(dispose).toHaveBeenCalledOnce()
  }
  expect(mocks.reportDiagnostic).toHaveBeenCalledExactlyOnceWith('MAIN_PROCESS_FAILED')

  activate()

  expect(mocks.constructWindow).toHaveBeenCalledTimes(3)
  expect(mocks.loadFile).toHaveBeenCalledTimes(3)
})

it('second-instance는 최소화된 기존 창을 복원한 뒤 표시하고 focus한다', async () => {
  vi.stubGlobal('__DFRAGON_CHANNEL__', readDesktopChannel('test', {}))
  await import('./main')
  await mocks.bootstrap
  const window = mocks.windows[0] as TestWindow
  window.isMinimized.mockReturnValue(true)

  appListener('second-instance')()

  expect(window.restore).toHaveBeenCalledOnce()
  expect(window.show).toHaveBeenCalledOnce()
  expect(window.focus).toHaveBeenCalledOnce()
  expect(window.restore.mock.invocationCallOrder[0]).toBeLessThan(
    window.show.mock.invocationCallOrder[0]
  )
  expect(mocks.constructWindow).toHaveBeenCalledOnce()
})

it('second-instance의 창 활성화 실패를 Electron event 경계 밖으로 던지지 않는다', async () => {
  vi.stubGlobal('__DFRAGON_CHANNEL__', readDesktopChannel('test', {}))
  await import('./main')
  await mocks.bootstrap
  const window = mocks.windows[0] as TestWindow
  window.show.mockImplementationOnce(() => {
    throw new Error('Synthetic persistent window activation failure')
  })

  expect(() => appListener('second-instance')()).not.toThrow()
  expect(mocks.reportDiagnostic).toHaveBeenCalledExactlyOnceWith('MAIN_PROCESS_FAILED')
})

it('macOS activate의 창 재생성 실패를 Electron event 경계 밖으로 던지지 않는다', async () => {
  await import('./main')
  await mocks.bootstrap
  mocks.windows = []
  mocks.loadFile.mockImplementationOnce(() => {
    throw new Error('Synthetic window composition failure')
  })

  expect(() => appListener('activate')()).not.toThrow()
  expect(mocks.reportDiagnostic).toHaveBeenCalledExactlyOnceWith('MAIN_PROCESS_FAILED')
})

import * as fs from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { BrowserWindowConstructorOptions } from 'electron'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readDesktopChannel } from '../../build/channels'
import { AUTH_AVAILABLE_ARGUMENT } from '../preload/common/types/auth'

const syntheticProfilePath = join(process.cwd(), 'synthetic', 'dfragon-test-profile')

const mocks = vi.hoisted(() => {
  const constructWindow = vi.fn()
  const loadURL = vi.fn()
  const loadFile = vi.fn()
  const registerWindow = vi.fn()
  const registerDeveloperWindow = vi.fn(() => vi.fn())
  const registerVersionsWindow = vi.fn<
    typeof import('./versions/ipc-handler').registerVersionsWindow
  >(() => vi.fn())
  const disposeCharacterDetails = vi.fn()
  const openSelectedCharacterDetail =
    vi.fn<typeof import('./character-detail/windows').openSelectedCharacterDetail>()
  const registerCharacterDetailWindows = vi.fn<
    typeof import('./character-detail/windows').registerCharacterDetailWindows
  >(() => ({ open: vi.fn(), dispose: disposeCharacterDetails }))
  const permissionCheck = vi.fn()
  const permissionRequest = vi.fn()
  const disposeCapture = vi.fn()
  const registerCapture = vi.fn(() => disposeCapture)
  const registerDiagnosticsWindow = vi.fn(() => vi.fn())
  const registerWindowChromeWindow = vi.fn<
    typeof import('./window-chrome/ipc-handler').registerWindowChromeWindow
  >(() => vi.fn())
  const nativeTheme = { shouldUseDarkColors: false }
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
  const collectCurrentCapture = vi.fn(async () => ({ status: 'queued' }))
  const requestSingleInstanceLock = vi.fn(() => true)
  const quit = vi.fn()
  const createEffects = vi.fn()
  const searchClock = {}
  const createSearchClock = vi.fn()
  const bindPowerMonitor = vi.fn()
  const disposePowerMonitor = vi.fn()
  const powerMonitor = { on: vi.fn(), removeListener: vi.fn() }
  const bootstrapAuth = vi.fn()
  const applyProfile = vi.fn<typeof import('./auth/runtime-config').applyAuthRuntimeProfile>(
    (application, config) => {
      application.setPath('userData', config.userDataPath)
      application.getPath('userData')
      application.setName(config.appIdentity)
      application.setAppUserModelId(config.appIdentity)

      return config
    }
  )
  const registerAuth = vi.fn()
  const setPath = vi.fn()
  const getPath = vi.fn()
  const getVersion = vi.fn(() => '6.7.8')
  const setName = vi.fn()
  const setAppUserModelId = vi.fn()
  const exit = vi.fn()
  const appOn = vi.fn()
  const appRemoveListener = vi.fn()
  const windows = [] as unknown[]
  const coordinator = {
    captureGeneration: vi.fn(() => 1),
    handleReturnUrl: vi.fn()
  }

  return {
    constructWindow,
    loadURL,
    loadFile,
    registerWindow,
    registerDeveloperWindow,
    registerVersionsWindow,
    registerCharacterDetailWindows,
    openSelectedCharacterDetail,
    disposeCharacterDetails,
    permissionCheck,
    permissionRequest,
    registerCapture,
    disposeCapture,
    registerDiagnosticsWindow,
    registerWindowChromeWindow,
    nativeTheme,
    registerMainDiagnosticErrors,
    disposeMainDiagnostics,
    reportDiagnostic,
    registerDesktopShortcuts,
    updateNotices,
    createUpdateNotices,
    registerUpdateNoticeWindow,
    readReleaseFeed,
    collectCurrentCapture,
    bootstrap: undefined as Promise<void> | undefined,
    requestSingleInstanceLock,
    quit,
    createEffects,
    searchClock,
    createSearchClock,
    bindPowerMonitor,
    disposePowerMonitor,
    powerMonitor,
    bootstrapAuth,
    applyProfile,
    registerAuth,
    setPath,
    getPath,
    getVersion,
    setName,
    setAppUserModelId,
    exit,
    appOn,
    appRemoveListener,
    windows,
    coordinator,
    runtime: undefined as
      | {
          coordinator: typeof coordinator
          apiOrigin: string
          start: ReturnType<typeof vi.fn>
        }
      | undefined
  }
})
vi.mock('electron', () => {
  const powerMonitor = mocks.powerMonitor
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
    removeListener: mocks.appRemoveListener,
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

  return { powerMonitor, session, app, BrowserWindow, nativeTheme: mocks.nativeTheme }
})
vi.mock('@electron-toolkit/utils', () => {
  const electronApp = { setAppUserModelId: vi.fn() }
  const optimizer = { watchWindowShortcuts: vi.fn() }

  return { electronApp, optimizer, is: { dev: true } }
})
vi.mock('./developer/ipc-handler', () => ({
  registerDeveloperWindow: mocks.registerDeveloperWindow
}))
vi.mock('./versions/ipc-handler', () => ({
  registerVersionsWindow: mocks.registerVersionsWindow
}))
vi.mock('./character-detail/windows', () => ({
  registerCharacterDetailWindows: mocks.registerCharacterDetailWindows,
  openSelectedCharacterDetail: mocks.openSelectedCharacterDetail
}))
vi.mock('./capture/ipc-handler', () => ({
  registerCaptureIpc: mocks.registerCapture,
  registerCaptureWindow: mocks.registerWindow,
  collectCurrentCapture: mocks.collectCurrentCapture
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
vi.mock('./auth/runtime-effects', () => ({
  createAuthRuntimeEffects: mocks.createEffects
}))
vi.mock('./auth/runtime-config', async () => {
  const actual =
    await vi.importActual<typeof import('./auth/runtime-config')>('./auth/runtime-config')

  return { ...actual, applyAuthRuntimeProfile: mocks.applyProfile }
})
vi.mock('./auth/bootstrap', () => ({
  bootstrapAuthRuntime: mocks.bootstrapAuth
}))
vi.mock('./auth/ipc-handler', () => ({
  registerAuthIpc: mocks.registerAuth
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.setName.mockReset()
  mocks.windows = []
  mocks.nativeTheme.shouldUseDarkColors = false
  mocks.requestSingleInstanceLock.mockReturnValue(true)
  mocks.runtime = {
    coordinator: mocks.coordinator,
    apiOrigin: 'https://api.synthetic.test',
    start: vi.fn(async () => undefined)
  }
  mocks.bindPowerMonitor.mockReturnValue(mocks.disposePowerMonitor)
  mocks.createSearchClock.mockReturnValue(mocks.searchClock)
  mocks.createEffects.mockReturnValue({
    bindPowerMonitor: mocks.bindPowerMonitor,
    createSearchClock: mocks.createSearchClock
  })
  mocks.getPath.mockImplementation(() => {
    const userDataPath = process.env['DFRAGON_AUTH_USER_DATA_PATH']
    if (userDataPath == null) {
      return ''
    }

    return userDataPath
  })
  mocks.bootstrapAuth.mockResolvedValue(mocks.runtime)
  mocks.registerAuth.mockReturnValue(vi.fn())
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it.each([false, true])(
  '개발 빌드는 셸 설정 유무(%s)와 무관하게 고정 프로필과 accounts origin를 사용한다',
  async (hasShellConfiguration) => {
    vi.stubGlobal('__DFRAGON_CHANNEL__', readDesktopChannel('development', {}))
    if (hasShellConfiguration) {
      stubTrustedRuntimeEnvironment()
    }
    const appData = join(process.cwd(), 'synthetic-app-data')
    mocks.getPath.mockImplementation(() => appData)

    await import('./main')
    await mocks.bootstrap

    expect(mocks.applyProfile).toHaveBeenCalledWith(expect.anything(), {
      apiOrigin: 'https://localhost:3444',
      environment: 'development',
      providers: ['passkey'],
      appIdentity: 'dfragon.dev',
      userDataPath: join(appData, 'dfragon.dev')
    })
    expect(mocks.requestSingleInstanceLock).toHaveBeenCalledExactlyOnceWith()
    expect(mocks.bootstrapAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ apiOrigin: 'https://localhost:3444' })
      })
    )
  }
)

it('개발 빌드도 Windows profile 준비 실패를 우회하지 않는다', async () => {
  vi.stubGlobal('__DFRAGON_CHANNEL__', readDesktopChannel('development', {}))
  mocks.getPath.mockImplementation(() => join(process.cwd(), 'synthetic-app-data'))
  mocks.applyProfile.mockImplementationOnce(() => {
    throw new Error('Windows profile security is unavailable.')
  })

  await import('./main')
  await mocks.bootstrap

  expect(mocks.requestSingleInstanceLock).not.toHaveBeenCalled()
  expect(mocks.bootstrapAuth).not.toHaveBeenCalled()
  expect(mocks.setPath).not.toHaveBeenCalled()
  expect(mocks.constructWindow).toHaveBeenCalledOnce()
})

it('auth clock power listeners survive canceled quit and detach at committed shutdown', async () => {
  stubTrustedRuntimeEnvironment()
  await import('./main')
  await mocks.bootstrap

  expect(mocks.bindPowerMonitor).toHaveBeenCalledExactlyOnceWith(mocks.powerMonitor)
  expect(mocks.bindPowerMonitor.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.bootstrapAuth.mock.invocationCallOrder[0]
  )
  const beforeQuit = mocks.appOn.mock.calls.find(([event]) => event === 'before-quit')?.[1]
  const quit = mocks.appOn.mock.calls.find(([event]) => event === 'quit')?.[1]
  beforeQuit({ defaultPrevented: true })
  await Promise.resolve()
  expect(mocks.disposePowerMonitor).not.toHaveBeenCalled()

  quit()
  quit()
  expect(mocks.disposePowerMonitor).toHaveBeenCalledOnce()
})

it('detaches clock power listeners when auth bootstrap does not create a runtime', async () => {
  stubTrustedRuntimeEnvironment()
  mocks.bootstrapAuth.mockResolvedValueOnce(null)

  await import('./main')
  await mocks.bootstrap

  expect(mocks.disposePowerMonitor).toHaveBeenCalledOnce()
})

function stubTrustedRuntimeEnvironment(): void {
  vi.stubEnv('DFRAGON_AUTH_API_ORIGIN', 'https://api.synthetic.test')
  vi.stubEnv('DFRAGON_API_ORIGIN', 'https://api.synthetic.test')
  vi.stubEnv('DFRAGON_AUTH_ENVIRONMENT', 'test')
  vi.stubEnv('DFRAGON_AUTH_PROVIDERS', 'passkey')
  vi.stubEnv('DFRAGON_AUTH_APP_IDENTITY', 'com.synthetic.dfragon')
  vi.stubEnv('DFRAGON_AUTH_USER_DATA_PATH', syntheticProfilePath)
}

function deferred<Value>(): {
  promise: Promise<Value>
  resolve(value: Value): void
  reject(error: unknown): void
} {
  let resolve!: (value: Value) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<Value>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return { promise, resolve, reject }
}

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
  expect(mocks.registerCharacterDetailWindows).toHaveBeenCalledExactlyOnceWith({
    owner: mocks.windows[0],
    entry: join(__dirname, '../frontend/character-detail.html'),
    preload: join(__dirname, '../preload/character-detail.js'),
    devUrl: expected
  })
})

it('API 미구성에서도 상세 창은 고정된 제품 entry와 제한 preload로 조합한다', async () => {
  await import('./main')
  await mocks.bootstrap

  expect(mocks.registerCharacterDetailWindows).toHaveBeenCalledExactlyOnceWith({
    owner: mocks.windows[0],
    entry: join(__dirname, '../frontend/character-detail.html'),
    preload: join(__dirname, '../preload/character-detail.js'),
    devUrl: undefined
  })
  expect(mocks.registerCapture).toHaveBeenCalledExactlyOnceWith(
    undefined,
    { openSelected: mocks.openSelectedCharacterDetail },
    expect.objectContaining({ collect: expect.any(Function), dispose: expect.any(Function) })
  )
})

it('인증 미구성 기본 entry는 legacy를 포함한 media permission을 명시적으로 거절한다', async () => {
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

it('version metadata uses separate product and account origins and does not depend on login state', async () => {
  stubTrustedRuntimeEnvironment()
  vi.stubEnv('DFRAGON_API_ORIGIN', 'https://game.synthetic.test')
  await import('./main')
  await mocks.bootstrap

  expect(mocks.registerVersionsWindow).toHaveBeenCalledWith({
    window: mocks.windows[0],
    documentUrl: expect.stringContaining('/frontend/index.html'),
    desktop: expect.any(Function),
    apiOrigin: 'https://game.synthetic.test',
    accountsOrigin: 'https://api.synthetic.test'
  })
  const desktop = mocks.registerVersionsWindow.mock.calls[0][0].desktop
  expect(desktop()).toEqual({ version: '6.7.8', commit: null, dirty: null })
})

it('배포 채널만 새 버전 확인을 시작하고 앱 종료 때 정리한다', async () => {
  vi.stubGlobal(
    '__DFRAGON_CHANNEL__',
    readDesktopChannel('distribution', {
      DFRAGON_DISTRIBUTION_API_ORIGIN: 'https://api.synthetic.test'
    })
  )
  mocks.getPath.mockImplementation(() => join(process.cwd(), 'synthetic-app-data'))
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
  mocks.getPath.mockImplementation(() => join(process.cwd(), 'synthetic-app-data'))
  await import('./main')
  await mocks.bootstrap

  expect(mocks.updateNotices.start).not.toHaveBeenCalled()
  expect(mocks.registerUpdateNoticeWindow).toHaveBeenCalledOnce()
})

it.each([
  ['win32', false, { color: '#ffffff', symbolColor: '#1a1c20', height: 56 }, '#ffffff'],
  ['win32', true, { color: '#1d2025', symbolColor: '#f3f4f5', height: 56 }, '#1d2025'],
  ['linux', false, { color: '#ffffff', symbolColor: '#1a1c20', height: 56 }, '#ffffff'],
  ['linux', true, { color: '#1d2025', symbolColor: '#f3f4f5', height: 56 }, '#1d2025'],
  ['darwin', false, { height: 56 }, '#ffffff'],
  ['darwin', true, { height: 56 }, '#1d2025']
] as const)(
  '%s의 시스템 다크 모드 %s에 맞춰 제목 표시줄과 초기 창 색상을 설정한다',
  async (platform, shouldUseDarkColors, titleBarOverlay, backgroundColor) => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!
    Object.defineProperty(process, 'platform', { value: platform })
    mocks.nativeTheme.shouldUseDarkColors = shouldUseDarkColors
    try {
      await import('./main')
      await mocks.bootstrap

      expect(mocks.constructWindow).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          minWidth: 460,
          titleBarStyle: 'hidden',
          titleBarOverlay,
          backgroundColor
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

it('창 색상 IPC 등록 실패에도 캡처와 인증을 시작하고 창을 연다', async () => {
  stubTrustedRuntimeEnvironment()
  mocks.registerWindowChromeWindow.mockImplementationOnce(() => {
    throw new Error('Synthetic window chrome registration failure')
  })
  await import('./main')
  await mocks.bootstrap
  const window = mocks.windows[0] as {
    on: ReturnType<typeof vi.fn>
    show: ReturnType<typeof vi.fn>
  }
  const showWindow = window.on.mock.calls.find(
    ([event]) => event === 'ready-to-show'
  )![1] as () => void
  showWindow()

  expect(window.show).toHaveBeenCalledOnce()
  expect(mocks.registerCapture).toHaveBeenCalledOnce()
  expect(mocks.registerAuth).toHaveBeenCalledOnce()
  expect(mocks.loadFile).toHaveBeenCalledOnce()
  expect(mocks.runtime?.start).toHaveBeenCalledOnce()
})

it('capture and authentication still start when version metadata registration fails', async () => {
  stubTrustedRuntimeEnvironment()
  mocks.registerVersionsWindow.mockImplementationOnce(() => {
    throw new Error('synthetic metadata registration failure')
  })
  await import('./main')
  await mocks.bootstrap

  expect(mocks.registerCapture).toHaveBeenCalledOnce()
  expect(mocks.registerAuth).toHaveBeenCalledOnce()
  expect(mocks.loadFile).toHaveBeenCalledOnce()
  expect(mocks.runtime?.start).toHaveBeenCalledOnce()
})

it('완전한 trusted 설정에서 동일 document와 auth/search runtime을 제품에 연결한다', async () => {
  vi.stubEnv('DFRAGON_AUTH_API_ORIGIN', 'https://api.synthetic.test')
  vi.stubEnv('DFRAGON_API_ORIGIN', 'https://api.synthetic.test')
  vi.stubEnv('DFRAGON_AUTH_ENVIRONMENT', 'test')
  vi.stubEnv('DFRAGON_AUTH_PROVIDERS', 'passkey')
  vi.stubEnv('DFRAGON_AUTH_APP_IDENTITY', 'com.synthetic.dfragon')
  vi.stubEnv('DFRAGON_AUTH_USER_DATA_PATH', syntheticProfilePath)
  vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173')
  const appliedConfig = Object.freeze({
    apiOrigin: 'https://api.synthetic.test',
    environment: 'test',
    providers: ['passkey'] as const,
    appIdentity: 'com.synthetic.dfragon',
    userDataPath: syntheticProfilePath
  })
  const effects = Object.freeze({
    source: 'synthetic trusted effects',
    bindPowerMonitor: mocks.bindPowerMonitor
  })
  mocks.applyProfile.mockImplementationOnce((application, config) => {
    application.setPath('userData', config.userDataPath)
    application.getPath('userData')
    application.setName(config.appIdentity)
    application.setAppUserModelId(config.appIdentity)

    return appliedConfig
  })
  mocks.createEffects.mockReturnValueOnce(effects)

  await import('./main')
  await mocks.bootstrap

  expect(mocks.requestSingleInstanceLock).toHaveBeenCalledExactlyOnceWith()
  expect(mocks.createEffects.mock.calls).toEqual([
    [{ activateMainWindow: expect.any(Function) }],
    []
  ])
  expect(mocks.createSearchClock).toHaveBeenCalledExactlyOnceWith()
  expect(mocks.bootstrapAuth).toHaveBeenCalledExactlyOnceWith({
    config: appliedConfig,
    effects,
    isActive: expect.any(Function)
  })
  const bootstrapInput = mocks.bootstrapAuth.mock.calls[0][0]
  expect(bootstrapInput.config).toBe(appliedConfig)
  expect(bootstrapInput.effects).toBe(effects)
  expect(bootstrapInput.isActive()).toBe(true)
  expect(mocks.setPath).toHaveBeenCalledExactlyOnceWith('userData', syntheticProfilePath)
  expect(mocks.setName).toHaveBeenCalledExactlyOnceWith('com.synthetic.dfragon')
  expect(mocks.setAppUserModelId).toHaveBeenCalledExactlyOnceWith('com.synthetic.dfragon')
  expect(mocks.registerAuth).toHaveBeenCalledExactlyOnceWith({
    coordinator: mocks.coordinator,
    getWindow: expect.any(Function),
    documentUrl: 'http://localhost:5173/'
  })
  // 합성 BrowserWindow에서도 실제 renderer의 권한 경계를 생성 인자로 검증한다.
  expect(mocks.constructWindow).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      webPreferences: expect.objectContaining({
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        preload: expect.stringMatching(/[/\\]preload[/\\]index\.js$/),
        additionalArguments: [AUTH_AVAILABLE_ARGUMENT]
      })
    })
  )
  const window = mocks.windows[0] as {
    webContents: {
      setWindowOpenHandler: ReturnType<typeof vi.fn>
      on: ReturnType<typeof vi.fn>
    }
  }
  const getAuthWindow = mocks.registerAuth.mock.calls[0][0].getWindow as () => unknown
  expect(getAuthWindow()).toBe(window)
  const denyPopup = window.webContents.setWindowOpenHandler.mock.calls[0][0] as () => unknown
  expect(denyPopup()).toEqual({ action: 'deny' })
  const preventDefault = vi.fn()
  const preventNavigation = window.webContents.on.mock.calls.find(
    ([event]) => event === 'will-navigate'
  )?.[1] as (event: { preventDefault(): void }) => void
  preventNavigation({ preventDefault })
  expect(preventDefault).toHaveBeenCalledOnce()
  expect(mocks.registerCapture).toHaveBeenCalledExactlyOnceWith(
    {
      apiOrigin: 'https://api.synthetic.test',
      clock: mocks.searchClock,
      portraitEdgeMatchPolicy: { minSimilarity: 0.55, minCoverage: 0.8, minComparedPixels: 100 }
    },
    {
      openSelected: mocks.openSelectedCharacterDetail
    },
    expect.objectContaining({ collect: expect.any(Function), dispose: expect.any(Function) })
  )
  expect(mocks.registerWindow).toHaveBeenCalledExactlyOnceWith(
    expect.anything(),
    'http://localhost:5173/'
  )
  expect(mocks.runtime?.start).toHaveBeenCalledOnce()
  expect(mocks.runtime?.start.mock.invocationCallOrder[0]).toBeGreaterThan(
    mocks.registerAuth.mock.invocationCallOrder[0]
  )
  expect(mocks.setAppUserModelId.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.requestSingleInstanceLock.mock.invocationCallOrder[0]
  )
  const beforeQuit = mocks.appOn.mock.calls.find(
    ([event]) => event === 'before-quit'
  )?.[1] as (event: { defaultPrevented: boolean }) => void
  beforeQuit({ defaultPrevented: false })
  expect(bootstrapInput.isActive()).toBe(false)
})

it.each(['cancel', 'commit'] as const)(
  'bootstrap 직후 시작된 quit의 %s outcome 전에는 후속 composition을 시작하지 않는다',
  async (outcome) => {
    stubTrustedRuntimeEnvironment()
    let compositionBeforeOutcome: number | null = null
    mocks.bootstrapAuth.mockImplementationOnce(async () => {
      const beforeQuit = mocks.appOn.mock.calls.find(
        ([event]) => event === 'before-quit'
      )?.[1] as (event: { defaultPrevented: boolean }) => void
      const willQuit = mocks.appOn.mock.calls.find(
        ([event]) => event === 'will-quit'
      )?.[1] as (event: { defaultPrevented: boolean }) => void
      const quit = mocks.appOn.mock.calls.find(([event]) => event === 'quit')?.[1] as () => void

      queueMicrotask(() => {
        queueMicrotask(() => {
          beforeQuit({ defaultPrevented: false })
          if (outcome === 'cancel') {
            queueMicrotask(() => {
              willQuit({ defaultPrevented: true })
              compositionBeforeOutcome = mocks.constructWindow.mock.calls.length
            })

            return
          }

          queueMicrotask(() => {
            quit()
            compositionBeforeOutcome = mocks.constructWindow.mock.calls.length
          })
        })
      })

      return mocks.runtime
    })

    await import('./main')
    await mocks.bootstrap
    await vi.waitFor(() => expect(compositionBeforeOutcome).not.toBeNull())

    expect(compositionBeforeOutcome).toBe(0)
    const expectedCompositionCount = outcome === 'cancel' ? 1 : 0
    expect(mocks.constructWindow).toHaveBeenCalledTimes(expectedCompositionCount)
  }
)

it('file document의 closed 정리 뒤 activate에서 같은 runtime과 IPC를 다시 연결한다', async () => {
  stubTrustedRuntimeEnvironment()
  const expectedDocumentUrl = pathToFileURL(join(__dirname, '../frontend/index.html')).href

  await import('./main')
  await mocks.bootstrap
  const firstWindow = mocks.windows[0] as { on: ReturnType<typeof vi.fn> }
  const firstGetWindow = mocks.registerAuth.mock.calls[0][0].getWindow as () => unknown
  expect(firstGetWindow()).toBe(firstWindow)
  const closedRegistration = firstWindow.on.mock.calls.find(([event]) => event === 'closed')
  expect(closedRegistration).toBeDefined()
  const closeWindow = closedRegistration?.[1] as () => void
  const firstAuthDisposer = mocks.registerAuth.mock.results[0]?.value as ReturnType<typeof vi.fn>

  closeWindow()
  expect(firstGetWindow()).toBeNull()
  mocks.windows = []
  const activateRegistration = mocks.appOn.mock.calls.find(([event]) => event === 'activate')
  expect(activateRegistration).toBeDefined()
  const activate = activateRegistration?.[1] as () => void
  activate()
  const secondWindow = mocks.windows[0]
  const secondGetWindow = mocks.registerAuth.mock.calls[1][0].getWindow as () => unknown

  expect(firstAuthDisposer).toHaveBeenCalledOnce()
  expect(firstGetWindow()).toBeNull()
  expect(secondGetWindow()).toBe(secondWindow)
  expect(mocks.constructWindow).toHaveBeenCalledTimes(2)
  expect(mocks.registerAuth).toHaveBeenCalledTimes(2)
  expect(mocks.registerWindow).toHaveBeenNthCalledWith(1, expect.anything(), expectedDocumentUrl)
  expect(mocks.registerWindow).toHaveBeenNthCalledWith(2, expect.anything(), expectedDocumentUrl)
  expect(mocks.loadFile).toHaveBeenCalledTimes(2)
  expect(mocks.loadFile).toHaveBeenNthCalledWith(1, join(__dirname, '../frontend/index.html'))
  expect(mocks.loadFile).toHaveBeenNthCalledWith(2, join(__dirname, '../frontend/index.html'))
})

it('window 구성 후반 실패는 auth IPC와 partial instance를 폐기하고 다시 구성한다', async () => {
  stubTrustedRuntimeEnvironment()
  const authDisposers: Array<ReturnType<typeof vi.fn>> = []
  mocks.registerAuth.mockImplementation(() => {
    const dispose = vi.fn()
    authDisposers.push(dispose)

    return dispose
  })

  await import('./main')
  await mocks.bootstrap
  const firstWindow = mocks.windows[0] as { on: ReturnType<typeof vi.fn> }
  const closedRegistration = firstWindow.on.mock.calls.find(([event]) => event === 'closed')
  const closeWindow = closedRegistration?.[1] as () => void
  closeWindow()
  mocks.windows = []

  const disposeWindowChrome = vi.fn()
  mocks.registerWindowChromeWindow.mockReturnValueOnce(disposeWindowChrome)
  mocks.loadFile.mockImplementationOnce(() => {
    throw new Error('Synthetic late window composition failure')
  })
  const activate = mocks.appOn.mock.calls.find(
    ([event]) => event === 'second-instance'
  )![1] as () => void
  activate()
  const partialWindow = mocks.windows[0] as {
    destroy: ReturnType<typeof vi.fn>
    show: ReturnType<typeof vi.fn>
  }

  expect(partialWindow.destroy).toHaveBeenCalledOnce()
  expect(partialWindow.show).not.toHaveBeenCalled()
  expect(authDisposers[1]).toHaveBeenCalledOnce()
  expect(mocks.disposeCharacterDetails).toHaveBeenCalledOnce()
  expect(disposeWindowChrome).toHaveBeenCalledOnce()

  activate()

  expect(mocks.constructWindow).toHaveBeenCalledTimes(3)
  expect(mocks.registerAuth).toHaveBeenCalledTimes(3)
  expect(mocks.loadFile).toHaveBeenCalledTimes(3)
  expect(authDisposers[2]).not.toHaveBeenCalled()
})

it('profile owner의 document load rejection은 blank window를 폐기하고 nonzero로 종료한다', async () => {
  stubTrustedRuntimeEnvironment()
  mocks.loadFile.mockRejectedValueOnce(new Error('Synthetic document load failure'))

  await import('./main')
  await mocks.bootstrap
  await vi.waitFor(() => expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1))
  const window = mocks.windows[0] as { destroy: ReturnType<typeof vi.fn> }

  expect(window.destroy).toHaveBeenCalledOnce()
  expect(mocks.exit.mock.invocationCallOrder[0]).toBeLessThan(
    window.destroy.mock.invocationCallOrder[0]
  )
})

it('교체된 이전 window의 늦은 load rejection은 현재 window owner를 건드리지 않는다', async () => {
  stubTrustedRuntimeEnvironment()
  const firstLoad = deferred<void>()
  const authDisposers: Array<ReturnType<typeof vi.fn>> = []
  mocks.registerAuth.mockImplementation(() => {
    const dispose = vi.fn()
    authDisposers.push(dispose)

    return dispose
  })
  mocks.loadFile.mockReturnValueOnce(firstLoad.promise).mockResolvedValueOnce(undefined)

  await import('./main')
  await mocks.bootstrap
  const firstWindow = mocks.windows[0] as { on: ReturnType<typeof vi.fn> }
  const closeWindow = firstWindow.on.mock.calls.find(
    ([event]) => event === 'closed'
  )?.[1] as () => void
  closeWindow()
  mocks.windows = []
  const activate = mocks.appOn.mock.calls.find(
    ([event]) => event === 'second-instance'
  )![1] as () => void
  activate()
  const currentWindow = mocks.windows[0] as { destroy: ReturnType<typeof vi.fn> }
  const currentAuthDisposer = authDisposers[1]!

  firstLoad.reject(new Error('Synthetic stale document load failure'))
  await firstLoad.promise.catch(() => undefined)
  await Promise.resolve()

  expect(currentWindow.destroy).not.toHaveBeenCalled()
  expect(currentAuthDisposer).not.toHaveBeenCalled()
  expect(mocks.exit).not.toHaveBeenCalled()
})

it('진행 중인 close와 겹친 load rejection은 closed가 실제 종료를 확정할 때 폐기한다', async () => {
  stubTrustedRuntimeEnvironment()
  const pendingLoad = deferred<void>()
  mocks.loadFile.mockReturnValueOnce(pendingLoad.promise)

  await import('./main')
  await mocks.bootstrap
  const window = mocks.windows[0] as {
    on: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
  }
  const close = window.on.mock.calls.find(([event]) => event === 'close')?.[1] as (event: {
    defaultPrevented: boolean
  }) => void
  const closed = window.on.mock.calls.find(([event]) => event === 'closed')?.[1] as () => void

  close({ defaultPrevented: false })
  pendingLoad.reject(new Error('Synthetic load rejection during close'))
  await pendingLoad.promise.catch(() => undefined)
  await Promise.resolve()

  expect(window.destroy).not.toHaveBeenCalled()
  expect(mocks.exit).not.toHaveBeenCalled()

  closed()

  expect(window.destroy).not.toHaveBeenCalled()
  expect(mocks.exit).not.toHaveBeenCalled()
})

it.each(['close event', 'renderer beforeunload'] as const)(
  '%s가 close를 취소하면 보류한 load rejection을 owned fatal로 다시 처리한다',
  async (cancellationSource) => {
    stubTrustedRuntimeEnvironment()
    const pendingLoad = deferred<void>()
    mocks.loadFile.mockReturnValueOnce(pendingLoad.promise)

    await import('./main')
    await mocks.bootstrap
    const window = mocks.windows[0] as {
      on: ReturnType<typeof vi.fn>
      webContents: { on: ReturnType<typeof vi.fn> }
      destroy: ReturnType<typeof vi.fn>
    }
    const close = window.on.mock.calls.find(([event]) => event === 'close')?.[1] as (event: {
      defaultPrevented: boolean
    }) => void
    const willPreventUnload = window.webContents.on.mock.calls.find(
      ([event]) => event === 'will-prevent-unload'
    )?.[1] as (event: { defaultPrevented: boolean }) => void

    if (cancellationSource === 'close event') {
      pendingLoad.reject(new Error('Synthetic load rejection before canceled close'))
      let defaultPrevented = false
      const closeEvent = {
        get defaultPrevented() {
          return defaultPrevented
        },
        preventDefault() {
          defaultPrevented = true
        }
      }
      close(closeEvent)
      closeEvent.preventDefault()
      await pendingLoad.promise.catch(() => undefined)
      await Promise.resolve()
    } else {
      close({ defaultPrevented: false })
      await Promise.resolve()
      pendingLoad.reject(new Error('Synthetic load rejection during renderer beforeunload'))
      await pendingLoad.promise.catch(() => undefined)
      await Promise.resolve()
      expect(mocks.exit).not.toHaveBeenCalled()
      willPreventUnload({ defaultPrevented: false })
      await Promise.resolve()
    }

    expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1)
    expect(window.destroy).toHaveBeenCalledOnce()
  }
)

it('will-prevent-unload override가 unload를 허용하면 closed까지 load rejection을 보류한다', async () => {
  stubTrustedRuntimeEnvironment()
  const pendingLoad = deferred<void>()
  mocks.loadFile.mockReturnValueOnce(pendingLoad.promise)

  await import('./main')
  await mocks.bootstrap
  const window = mocks.windows[0] as {
    on: ReturnType<typeof vi.fn>
    webContents: { on: ReturnType<typeof vi.fn> }
    destroy: ReturnType<typeof vi.fn>
  }
  const close = window.on.mock.calls.find(([event]) => event === 'close')?.[1] as (event: {
    defaultPrevented: boolean
  }) => void
  const closed = window.on.mock.calls.find(([event]) => event === 'closed')?.[1] as () => void
  const willPreventUnload = window.webContents.on.mock.calls.find(
    ([event]) => event === 'will-prevent-unload'
  )?.[1] as (event: { defaultPrevented: boolean }) => void

  close({ defaultPrevented: false })
  await Promise.resolve()
  pendingLoad.reject(new Error('Synthetic load rejection during allowed renderer unload'))
  await pendingLoad.promise.catch(() => undefined)
  await Promise.resolve()
  let defaultPrevented = false
  const willPreventUnloadEvent = {
    get defaultPrevented() {
      return defaultPrevented
    },
    preventDefault() {
      defaultPrevented = true
    }
  }
  willPreventUnload(willPreventUnloadEvent)
  willPreventUnloadEvent.preventDefault()
  await Promise.resolve()

  expect(window.destroy).not.toHaveBeenCalled()
  expect(mocks.exit).not.toHaveBeenCalled()

  closed()

  expect(window.destroy).not.toHaveBeenCalled()
  expect(mocks.exit).not.toHaveBeenCalled()
})

it('동기 before-quit 취소 뒤에는 window activation을 다시 사용한다', async () => {
  stubTrustedRuntimeEnvironment()

  await import('./main')
  await mocks.bootstrap
  const beforeQuit = mocks.appOn.mock.calls.find(
    ([event]) => event === 'before-quit'
  )?.[1] as (event: { defaultPrevented: boolean }) => void
  const activate = mocks.appOn.mock.calls.find(
    ([event]) => event === 'second-instance'
  )![1] as () => void
  const window = mocks.windows[0] as {
    show: ReturnType<typeof vi.fn>
    focus: ReturnType<typeof vi.fn>
  }
  let defaultPrevented = false
  const beforeQuitEvent = {
    get defaultPrevented() {
      return defaultPrevented
    },
    preventDefault() {
      defaultPrevented = true
    }
  }

  beforeQuit(beforeQuitEvent)
  beforeQuitEvent.preventDefault()
  await Promise.resolve()
  activate()

  expect(window.show).toHaveBeenCalledOnce()
  expect(window.focus).toHaveBeenCalledOnce()
  expect(mocks.exit).not.toHaveBeenCalled()
})

it('동기 will-quit 취소 뒤에도 window activation을 다시 사용한다', async () => {
  stubTrustedRuntimeEnvironment()

  await import('./main')
  await mocks.bootstrap
  const beforeQuit = mocks.appOn.mock.calls.find(
    ([event]) => event === 'before-quit'
  )?.[1] as (event: { defaultPrevented: boolean }) => void
  const willQuit = mocks.appOn.mock.calls.find(([event]) => event === 'will-quit')?.[1] as (event: {
    defaultPrevented: boolean
  }) => void
  const activate = mocks.appOn.mock.calls.find(
    ([event]) => event === 'second-instance'
  )![1] as () => void
  const window = mocks.windows[0] as {
    show: ReturnType<typeof vi.fn>
    focus: ReturnType<typeof vi.fn>
  }
  let defaultPrevented = false
  const willQuitEvent = {
    get defaultPrevented() {
      return defaultPrevented
    },
    preventDefault() {
      defaultPrevented = true
    }
  }

  beforeQuit({ defaultPrevented: false })
  willQuit(willQuitEvent)
  willQuitEvent.preventDefault()
  await Promise.resolve()
  activate()

  expect(window.show).toHaveBeenCalledOnce()
  expect(window.focus).toHaveBeenCalledOnce()
  expect(mocks.exit).not.toHaveBeenCalled()
})

it('before-quit 취소 전에 보류한 restore rejection은 fatal로 다시 처리한다', async () => {
  stubTrustedRuntimeEnvironment()
  const pendingStart = deferred<void>()
  mocks.runtime!.start = vi.fn(() => pendingStart.promise)

  await import('./main')
  await mocks.bootstrap
  const beforeQuit = mocks.appOn.mock.calls.find(
    ([event]) => event === 'before-quit'
  )?.[1] as (event: { defaultPrevented: boolean }) => void
  let defaultPrevented = false
  const beforeQuitEvent = {
    get defaultPrevented() {
      return defaultPrevented
    },
    preventDefault() {
      defaultPrevented = true
    }
  }

  pendingStart.reject(new Error('Synthetic restore failure during canceled app quit'))
  beforeQuit(beforeQuitEvent)
  beforeQuitEvent.preventDefault()
  await pendingStart.promise.catch(() => undefined)
  await Promise.resolve()

  expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1)
})

it('renderer beforeunload가 app quit을 취소하면 보류한 load rejection을 fatal로 다시 처리한다', async () => {
  stubTrustedRuntimeEnvironment()
  const pendingLoad = deferred<void>()
  mocks.loadFile.mockReturnValueOnce(pendingLoad.promise)

  await import('./main')
  await mocks.bootstrap
  const beforeQuit = mocks.appOn.mock.calls.find(
    ([event]) => event === 'before-quit'
  )?.[1] as (event: { defaultPrevented: boolean }) => void
  const window = mocks.windows[0] as {
    on: ReturnType<typeof vi.fn>
    webContents: { on: ReturnType<typeof vi.fn> }
    destroy: ReturnType<typeof vi.fn>
  }
  const close = window.on.mock.calls.find(([event]) => event === 'close')?.[1] as (event: {
    defaultPrevented: boolean
  }) => void
  const willPreventUnload = window.webContents.on.mock.calls.find(
    ([event]) => event === 'will-prevent-unload'
  )?.[1] as (event: { defaultPrevented: boolean }) => void

  beforeQuit({ defaultPrevented: false })
  close({ defaultPrevented: false })
  pendingLoad.reject(new Error('Synthetic load rejection during canceled app quit'))
  await pendingLoad.promise.catch(() => undefined)
  await Promise.resolve()

  expect(mocks.exit).not.toHaveBeenCalled()

  willPreventUnload({ defaultPrevented: false })
  await Promise.resolve()

  expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1)
  expect(window.destroy).toHaveBeenCalledOnce()
})

it('확정된 정상 quit 뒤의 늦은 document load rejection은 nonzero 종료로 바꾸지 않는다', async () => {
  stubTrustedRuntimeEnvironment()
  const pendingLoad = deferred<void>()
  mocks.loadFile.mockReturnValueOnce(pendingLoad.promise)

  await import('./main')
  await mocks.bootstrap
  const beforeQuit = mocks.appOn.mock.calls.find(
    ([event]) => event === 'before-quit'
  )?.[1] as (event: { defaultPrevented: boolean }) => void
  const quit = mocks.appOn.mock.calls.find(([event]) => event === 'quit')?.[1] as () => void
  const window = mocks.windows[0] as { destroy: ReturnType<typeof vi.fn> }
  beforeQuit({ defaultPrevented: false })
  quit()

  pendingLoad.reject(new Error('Synthetic late document load failure'))
  await pendingLoad.promise.catch(() => undefined)
  await Promise.resolve()

  expect(window.destroy).not.toHaveBeenCalled()
  expect(mocks.exit).not.toHaveBeenCalled()
})

it('profile owner의 activate 재구성 예외는 event 밖으로 던지지 않고 nonzero로 종료한다', async () => {
  stubTrustedRuntimeEnvironment()

  await import('./main')
  await mocks.bootstrap
  const firstWindow = mocks.windows[0] as { isDestroyed: ReturnType<typeof vi.fn> }
  firstWindow.isDestroyed.mockReturnValue(true)
  mocks.windows = []
  mocks.constructWindow.mockImplementationOnce(() => {
    throw new Error('Synthetic activate construction failure')
  })
  const registration = mocks.appOn.mock.calls.find(([event]) => event === 'activate')
  expect(registration).toBeDefined()
  const activate = registration?.[1] as () => void

  expect(() => activate()).not.toThrow()
  expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1)
})

it('does not activate product auth for the unsupported OAuth provider', async () => {
  vi.stubEnv('DFRAGON_AUTH_API_ORIGIN', 'https://api.synthetic.test')
  vi.stubEnv('DFRAGON_API_ORIGIN', 'https://api.synthetic.test')
  vi.stubEnv('DFRAGON_AUTH_ENVIRONMENT', 'test')
  vi.stubEnv('DFRAGON_AUTH_PROVIDERS', 'discord')
  vi.stubEnv('DFRAGON_AUTH_APP_IDENTITY', 'com.synthetic.dfragon')
  vi.stubEnv('DFRAGON_AUTH_USER_DATA_PATH', syntheticProfilePath)

  await import('./main')
  await mocks.bootstrap

  expect(mocks.requestSingleInstanceLock).not.toHaveBeenCalled()
  expect(mocks.bindPowerMonitor).not.toHaveBeenCalled()
  expect(mocks.bootstrapAuth).not.toHaveBeenCalled()
  expect(mocks.registerAuth).not.toHaveBeenCalled()
  expect(mocks.setPath).not.toHaveBeenCalled()
  expect(mocks.createSearchClock).toHaveBeenCalledExactlyOnceWith()
  expect(mocks.registerCapture).toHaveBeenCalledExactlyOnceWith(
    {
      apiOrigin: 'https://api.synthetic.test',
      clock: mocks.searchClock,
      portraitEdgeMatchPolicy: { minSimilarity: 0.55, minCoverage: 0.8, minComparedPixels: 100 }
    },
    {
      openSelected: mocks.openSelectedCharacterDetail
    },
    expect.objectContaining({ collect: expect.any(Function), dispose: expect.any(Function) })
  )
})

it('profile 적용이 시작된 뒤 실패하면 부분 적용된 userData로 시작하지 않는다', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(join(homedir(), '.dfragon-main-profile-')))
  fs.chmodSync(root, 0o700)
  const userDataPath = join(root, 'profile')
  fs.mkdirSync(userDataPath, { mode: 0o700 })
  vi.stubEnv('DFRAGON_AUTH_API_ORIGIN', 'https://api.synthetic.test')
  vi.stubEnv('DFRAGON_API_ORIGIN', 'https://api.synthetic.test')
  vi.stubEnv('DFRAGON_AUTH_ENVIRONMENT', 'test')
  vi.stubEnv('DFRAGON_AUTH_PROVIDERS', 'passkey')
  vi.stubEnv('DFRAGON_AUTH_APP_IDENTITY', 'com.synthetic.dfragon')
  vi.stubEnv('DFRAGON_AUTH_USER_DATA_PATH', userDataPath)
  const runtimeConfigModule = await import('./auth/runtime-config')
  const actual =
    await vi.importActual<typeof import('./auth/runtime-config')>('./auth/runtime-config')
  mocks.applyProfile.mockImplementationOnce((application, config) => {
    try {
      return actual.applyAuthRuntimeProfile(application, config, {
        ...fs,
        realpathSync: fs.realpathSync.native,
        windows: {
          inspectDirectory: () => 'trusted',
          createDirectory: () => {
            throw new Error('Unexpected synthetic Windows profile creation')
          },
          syncDirectory: () => {}
        }
      })
    } catch {
      throw new runtimeConfigModule.AuthRuntimeProfileApplicationFailure()
    }
  })
  mocks.setName.mockImplementationOnce(() => {
    throw new Error('Synthetic app identity failure')
  })

  try {
    await import('./main')
    await mocks.bootstrap

    expect(mocks.setPath).toHaveBeenCalledExactlyOnceWith('userData', userDataPath)
    expect(mocks.setName).toHaveBeenCalledExactlyOnceWith('com.synthetic.dfragon')
    expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1)
    expect(mocks.requestSingleInstanceLock).not.toHaveBeenCalled()
    expect(mocks.bootstrapAuth).not.toHaveBeenCalled()
    expect(mocks.constructWindow).not.toHaveBeenCalled()
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

it('profile 준비 실패는 Electron 전역값과 lock을 건드리지 않고 비인증 window로 전환한다', async () => {
  stubTrustedRuntimeEnvironment()
  mocks.applyProfile.mockImplementationOnce(() => {
    throw new Error('Synthetic profile preparation failure')
  })

  await import('./main')
  await mocks.bootstrap

  expect(mocks.setPath).not.toHaveBeenCalled()
  expect(mocks.requestSingleInstanceLock).not.toHaveBeenCalled()
  expect(mocks.bootstrapAuth).not.toHaveBeenCalled()
  expect(mocks.exit).not.toHaveBeenCalled()
  expect(mocks.constructWindow).toHaveBeenCalledOnce()
})

it('single-instance loser는 auth/store/window 초기화 없이 종료한다', async () => {
  vi.stubEnv('DFRAGON_AUTH_API_ORIGIN', 'https://api.synthetic.test')
  vi.stubEnv('DFRAGON_API_ORIGIN', 'https://api.synthetic.test')
  vi.stubEnv('DFRAGON_AUTH_ENVIRONMENT', 'test')
  vi.stubEnv('DFRAGON_AUTH_PROVIDERS', 'passkey')
  vi.stubEnv('DFRAGON_AUTH_APP_IDENTITY', 'com.synthetic.dfragon')
  vi.stubEnv('DFRAGON_AUTH_USER_DATA_PATH', syntheticProfilePath)
  mocks.requestSingleInstanceLock.mockReturnValueOnce(false)

  await import('./main')
  await mocks.bootstrap

  expect(mocks.quit).toHaveBeenCalledOnce()
  expect(mocks.createEffects).not.toHaveBeenCalled()
  expect(mocks.bootstrapAuth).not.toHaveBeenCalled()
  expect(mocks.registerAuth).not.toHaveBeenCalled()
  expect(mocks.registerWindow).not.toHaveBeenCalled()
  expect(mocks.constructWindow).not.toHaveBeenCalled()
})

it('profile owner의 auth bootstrap이 runtime을 만들지 않으면 비인증 window로 전환한다', async () => {
  stubTrustedRuntimeEnvironment()
  mocks.bootstrapAuth.mockResolvedValueOnce(null)

  await import('./main')
  await mocks.bootstrap

  expect(mocks.exit).not.toHaveBeenCalled()
  expect(mocks.registerAuth).not.toHaveBeenCalled()
  expect(mocks.constructWindow).toHaveBeenCalledOnce()
  // 인증 IPC가 없는 창의 preload는 인증 API를 노출하지 않아야 한다.
  const options: BrowserWindowConstructorOptions = mocks.constructWindow.mock.calls[0][0]
  expect(options.webPreferences?.additionalArguments ?? []).not.toContain(AUTH_AVAILABLE_ARGUMENT)
})

it('auth bootstrap fallback에서도 second-instance는 기존 창을 활성화한다', async () => {
  stubTrustedRuntimeEnvironment()
  mocks.bootstrapAuth.mockResolvedValueOnce(null)

  await import('./main')
  await mocks.bootstrap
  const secondInstance = mocks.appOn.mock.calls.find(
    ([event]) => event === 'second-instance'
  )![1] as () => void
  const window = mocks.windows[0] as {
    show: ReturnType<typeof vi.fn>
    focus: ReturnType<typeof vi.fn>
  }

  secondInstance()
  expect(window.show).toHaveBeenCalledOnce()
  expect(window.focus).toHaveBeenCalledOnce()
  expect(mocks.requestSingleInstanceLock).toHaveBeenCalledExactlyOnceWith()
})

it.each([
  [
    'runtime effect 생성',
    () =>
      mocks.createEffects.mockImplementationOnce(() => {
        throw new Error('Synthetic runtime effect construction failure')
      })
  ],
  [
    'bootstrap 구성',
    () =>
      mocks.bootstrapAuth.mockRejectedValueOnce(
        new Error('Synthetic auth bootstrap construction failure')
      )
  ]
] as const)('profile owner의 예상 밖 %s 실패는 nonzero로 종료한다', async (_name, fail) => {
  stubTrustedRuntimeEnvironment()
  fail()

  await import('./main')
  await mocks.bootstrap

  expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1)
  expect(mocks.registerCapture).not.toHaveBeenCalled()
  expect(mocks.constructWindow).not.toHaveBeenCalled()
})

it('auth bootstrap 대기 중 quit은 IPC, window와 restore를 뒤늦게 시작하지 않는다', async () => {
  stubTrustedRuntimeEnvironment()
  const pendingBootstrap = deferred<typeof mocks.runtime>()
  mocks.bootstrapAuth.mockReturnValueOnce(pendingBootstrap.promise)

  await import('./main')
  await vi.waitFor(() => expect(mocks.bootstrapAuth).toHaveBeenCalledOnce())
  const beforeQuitRegistration = mocks.appOn.mock.calls.find(([event]) => event === 'before-quit')
  expect(beforeQuitRegistration).toBeDefined()
  const beforeQuit = beforeQuitRegistration?.[1] as (event: { defaultPrevented: boolean }) => void
  const quit = mocks.appOn.mock.calls.find(([event]) => event === 'quit')?.[1] as () => void

  beforeQuit({ defaultPrevented: false })
  quit()
  pendingBootstrap.resolve(mocks.runtime)
  await mocks.bootstrap

  expect(mocks.registerCapture).not.toHaveBeenCalled()
  expect(mocks.registerAuth).not.toHaveBeenCalled()
  expect(mocks.constructWindow).not.toHaveBeenCalled()
  expect(mocks.runtime?.start).not.toHaveBeenCalled()
})

it('auth bootstrap 대기 중 quit이 취소되면 composition을 다시 진행한다', async () => {
  stubTrustedRuntimeEnvironment()
  const pendingBootstrap = deferred<typeof mocks.runtime>()
  mocks.bootstrapAuth.mockReturnValueOnce(pendingBootstrap.promise)

  await import('./main')
  await vi.waitFor(() => expect(mocks.bootstrapAuth).toHaveBeenCalledOnce())
  const beforeQuit = mocks.appOn.mock.calls.find(
    ([event]) => event === 'before-quit'
  )?.[1] as (event: { defaultPrevented: boolean }) => void
  const willQuit = mocks.appOn.mock.calls.find(([event]) => event === 'will-quit')?.[1] as (event: {
    defaultPrevented: boolean
  }) => void

  beforeQuit({ defaultPrevented: false })
  pendingBootstrap.resolve(mocks.runtime)
  await Promise.resolve()
  await Promise.resolve()

  expect(mocks.constructWindow).not.toHaveBeenCalled()

  let defaultPrevented = false
  const willQuitEvent = {
    get defaultPrevented() {
      return defaultPrevented
    },
    preventDefault() {
      defaultPrevented = true
    }
  }
  willQuit(willQuitEvent)
  willQuitEvent.preventDefault()
  await mocks.bootstrap

  expect(mocks.registerCapture).toHaveBeenCalledOnce()
  expect(mocks.registerAuth).toHaveBeenCalledOnce()
  expect(mocks.constructWindow).toHaveBeenCalledOnce()
  expect(mocks.runtime?.start).toHaveBeenCalledOnce()
})

it('start 성공과 second-instance가 quit 시도 중 겹쳐도 취소 뒤 한 번 활성화한다', async () => {
  stubTrustedRuntimeEnvironment()
  const pendingStart = deferred<void>()
  mocks.runtime!.start = vi.fn(() => pendingStart.promise)

  await import('./main')
  await mocks.bootstrap
  const beforeQuit = mocks.appOn.mock.calls.find(
    ([event]) => event === 'before-quit'
  )?.[1] as (event: { defaultPrevented: boolean }) => void
  const window = mocks.windows[0] as {
    on: ReturnType<typeof vi.fn>
    webContents: { on: ReturnType<typeof vi.fn> }
    show: ReturnType<typeof vi.fn>
  }
  const close = window.on.mock.calls.find(([event]) => event === 'close')?.[1] as (event: {
    defaultPrevented: boolean
  }) => void
  const willPreventUnload = window.webContents.on.mock.calls.find(
    ([event]) => event === 'will-prevent-unload'
  )?.[1] as (event: { defaultPrevented: boolean }) => void

  beforeQuit({ defaultPrevented: false })
  close({ defaultPrevented: false })
  pendingStart.resolve()
  await pendingStart.promise
  await Promise.resolve()

  const activate = mocks.appOn.mock.calls.find(
    ([event]) => event === 'second-instance'
  )![1] as () => void
  activate()
  await Promise.resolve()

  expect(window.show).not.toHaveBeenCalled()

  willPreventUnload({ defaultPrevented: false })
  await vi.waitFor(() => expect(window.show).toHaveBeenCalledOnce())

  expect(window.show).toHaveBeenCalledOnce()
})

it('profile owner의 예상 밖 restore rejection은 nonzero로 종료한다', async () => {
  stubTrustedRuntimeEnvironment()
  mocks.runtime!.start = vi.fn(async () => {
    throw new Error('Synthetic unexpected restore failure')
  })

  await import('./main')
  await mocks.bootstrap
  await vi.waitFor(() => expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1))
})

it('정상 quit 뒤의 늦은 restore rejection은 nonzero 종료로 바꾸지 않는다', async () => {
  stubTrustedRuntimeEnvironment()
  const pendingStart = deferred<void>()
  mocks.runtime!.start = vi.fn(() => pendingStart.promise)

  await import('./main')
  await mocks.bootstrap
  const beforeQuitRegistration = mocks.appOn.mock.calls.find(([event]) => event === 'before-quit')
  expect(beforeQuitRegistration).toBeDefined()
  const beforeQuit = beforeQuitRegistration?.[1] as (event: { defaultPrevented: boolean }) => void
  const quit = mocks.appOn.mock.calls.find(([event]) => event === 'quit')?.[1] as () => void

  beforeQuit({ defaultPrevented: false })
  quit()
  pendingStart.reject(new Error('Synthetic late restore failure'))
  await pendingStart.promise.catch(() => undefined)
  await Promise.resolve()

  expect(mocks.exit).not.toHaveBeenCalled()
})

it('profile owner의 post-bootstrap composition 예외는 nonzero로 종료한다', async () => {
  stubTrustedRuntimeEnvironment()
  mocks.registerCapture.mockImplementationOnce(() => {
    throw new Error('Synthetic capture composition failure')
  })

  await import('./main')
  await mocks.bootstrap

  expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1)
  expect(mocks.constructWindow).not.toHaveBeenCalled()
  expect(mocks.runtime?.start).not.toHaveBeenCalled()
})

it('URL 없는 second-instance는 기존 창을 표시하고 focus한다', async () => {
  vi.stubEnv('DFRAGON_AUTH_API_ORIGIN', 'https://api.synthetic.test')
  vi.stubEnv('DFRAGON_API_ORIGIN', 'https://api.synthetic.test')
  vi.stubEnv('DFRAGON_AUTH_ENVIRONMENT', 'test')
  vi.stubEnv('DFRAGON_AUTH_PROVIDERS', 'passkey')
  vi.stubEnv('DFRAGON_AUTH_APP_IDENTITY', 'com.synthetic.dfragon')
  vi.stubEnv('DFRAGON_AUTH_USER_DATA_PATH', syntheticProfilePath)

  await import('./main')
  await mocks.bootstrap
  const activate = mocks.appOn.mock.calls.find(
    ([event]) => event === 'second-instance'
  )![1] as () => void
  expect(activate).toBeTypeOf('function')
  const window = mocks.windows[0] as {
    show: ReturnType<typeof vi.fn>
    focus: ReturnType<typeof vi.fn>
  }

  activate()

  expect(window.show).toHaveBeenCalledOnce()
  expect(window.focus).toHaveBeenCalledOnce()
})

it('URL 없는 second-instance는 최소화된 기존 창을 복원한 뒤 표시하고 focus한다', async () => {
  stubTrustedRuntimeEnvironment()

  await import('./main')
  await mocks.bootstrap
  const activate = mocks.appOn.mock.calls.find(
    ([event]) => event === 'second-instance'
  )![1] as () => void
  expect(activate).toBeTypeOf('function')
  const window = mocks.windows[0] as {
    isMinimized: ReturnType<typeof vi.fn>
    restore: ReturnType<typeof vi.fn>
    show: ReturnType<typeof vi.fn>
    focus: ReturnType<typeof vi.fn>
  }
  window.isMinimized.mockReturnValue(true)

  activate()

  expect(window.restore).toHaveBeenCalledOnce()
  expect(window.show).toHaveBeenCalledOnce()
  expect(window.focus).toHaveBeenCalledOnce()
  expect(window.restore.mock.invocationCallOrder[0]).toBeLessThan(
    window.show.mock.invocationCallOrder[0]
  )
})

it('일반 second-instance의 window 활성화 실패를 Electron event 경계 밖으로 던지지 않는다', async () => {
  stubTrustedRuntimeEnvironment()

  await import('./main')
  await mocks.bootstrap
  const activate = mocks.appOn.mock.calls.find(
    ([event]) => event === 'second-instance'
  )![1] as () => void
  expect(activate).toBeTypeOf('function')
  const window = mocks.windows[0] as { show: ReturnType<typeof vi.fn> }
  window.show.mockImplementationOnce(() => {
    throw new Error('Synthetic persistent window activation failure')
  })

  expect(() => activate()).not.toThrow()
})

it('open-url을 등록하지 않고 URL handoff 없이 single-instance lock을 요청한다', async () => {
  stubTrustedRuntimeEnvironment()

  await import('./main')
  await mocks.bootstrap

  expect(mocks.appOn.mock.calls.some(([event]) => event === 'open-url')).toBe(false)
  expect(mocks.requestSingleInstanceLock).toHaveBeenCalledExactlyOnceWith()
})

it.each(['bootstrap', 'restore'] as const)(
  '%s 대기 중 두 번째 실행은 완료 뒤 한 번만 창을 활성화한다',
  async (stage) => {
    stubTrustedRuntimeEnvironment()
    const pending = deferred<void>()
    if (stage === 'bootstrap') {
      mocks.bootstrapAuth.mockImplementationOnce(async () => {
        await pending.promise

        return mocks.runtime
      })
    } else {
      mocks.runtime!.start = vi.fn(() => pending.promise)
    }

    await import('./main')
    const secondInstance = mocks.appOn.mock.calls.find(
      ([event]) => event === 'second-instance'
    )![1] as () => void
    secondInstance()
    secondInstance()
    if (stage === 'bootstrap') {
      expect(mocks.constructWindow).not.toHaveBeenCalled()
    } else {
      expect(mocks.constructWindow).toHaveBeenCalledOnce()
      const window = mocks.windows[0] as { show: ReturnType<typeof vi.fn> }
      expect(window.show).not.toHaveBeenCalled()
    }

    pending.resolve()
    await mocks.bootstrap
    const window = mocks.windows[0] as {
      show: ReturnType<typeof vi.fn>
      focus: ReturnType<typeof vi.fn>
    }
    await vi.waitFor(() => expect(window.show).toHaveBeenCalledOnce())
    expect(window.focus).toHaveBeenCalledOnce()
  }
)

it('effects의 활성화 callback은 현재 창을 focus하고, 창이 없으면 같은 auth runtime으로 재생성한다', async () => {
  vi.stubEnv('DFRAGON_AUTH_API_ORIGIN', 'https://api.synthetic.test')
  vi.stubEnv('DFRAGON_API_ORIGIN', 'https://api.synthetic.test')
  vi.stubEnv('DFRAGON_AUTH_ENVIRONMENT', 'test')
  vi.stubEnv('DFRAGON_AUTH_PROVIDERS', 'passkey')
  vi.stubEnv('DFRAGON_AUTH_APP_IDENTITY', 'com.synthetic.dfragon')
  vi.stubEnv('DFRAGON_AUTH_USER_DATA_PATH', syntheticProfilePath)
  vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173')

  await import('./main')
  await mocks.bootstrap
  const activate = mocks.createEffects.mock.calls[0][0].activateMainWindow as () => void
  const firstWindow = mocks.windows[0] as {
    show: ReturnType<typeof vi.fn>
    focus: ReturnType<typeof vi.fn>
    isDestroyed: ReturnType<typeof vi.fn>
  }

  activate()
  expect(firstWindow.show).toHaveBeenCalledOnce()
  expect(firstWindow.focus).toHaveBeenCalledOnce()

  firstWindow.isDestroyed = vi.fn(() => true)
  activate()
  expect(mocks.constructWindow).toHaveBeenCalledTimes(2)
  expect(mocks.registerAuth).toHaveBeenCalledTimes(2)
  expect(mocks.registerWindow).toHaveBeenCalledTimes(2)
})

it.each([
  { platform: 'win32', configured: true },
  { platform: 'win32', configured: false },
  { platform: 'darwin', configured: true },
  { platform: 'linux', configured: true }
])(
  'product session denies media permission checks and requests: %j',
  async ({ platform, configured }) => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!
    Object.defineProperty(process, 'platform', { value: platform })
    try {
      if (configured) {
        stubTrustedRuntimeEnvironment()
      }
      await import('./main')
      await mocks.bootstrap
      const documentUrl = 'file:///fixture/index.html'
      const callback = vi.fn()

      expect(mocks.permissionCheck).toHaveBeenCalledOnce()
      expect(mocks.permissionRequest).toHaveBeenCalledOnce()
      expect(
        mocks.permissionCheck.mock.calls[0][0]({}, 'media', documentUrl, {
          isMainFrame: true,
          mediaType: 'video',
          requestingUrl: documentUrl
        })
      ).toBe(false)
      // 예전 제품이 캡처 수명마다 한 번 허용하던 main frame의 빈 mediaTypes 요청도 거절한다.
      mocks.permissionRequest.mock.calls[0][0]({}, 'media', callback, {
        mediaTypes: [],
        isMainFrame: true,
        requestingUrl: documentUrl
      })
      expect(callback).toHaveBeenCalledExactlyOnceWith(false)
    } finally {
      Object.defineProperty(process, 'platform', originalPlatform)
    }
  }
)

import { app, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'node:url'
import { optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { validateDevRendererUrl } from './renderer-document'
import { registerCaptureIpc, registerCaptureWindow } from './capture/ipc-handler'
import { registerCapturePermissions } from './capture/permission-policy'
import { readAppApiOrigin, readAppChannelName, readAppIdentity } from './lib/app-channel'
import { createMonotonicClock } from './lib/monotonic-clock'
import { fetchApi } from './api-fetch'
import { readReleaseFeed } from './update-notice/http'
import { createUpdateNotices } from './update-notice/notices'
import { registerUpdateNoticeWindow } from './update-notice/ipc-handler'
import { INITIAL_PORTRAIT_COLOR_POLICY } from './search/portrait-policy'
import { createLazyScoreEngine, loadScoreEngine, resolveScoreLibraryPath } from './score/engine'
import { registerDesktopShortcuts } from './shortcuts/register'
import { registerDiagnosticsWindow } from './diagnostics/ipc-handler'
import { registerWindowChromeWindow } from './window-chrome/ipc-handler'
import { MAIN_WINDOW_SIZE, WINDOW_CHROME_COLORS } from '../preload/common/window-chrome'
import { getTitleBarOverlay } from './window-chrome/title-bar-overlay'
import { registerMainDiagnosticErrors, reportDiagnostic } from './diagnostics/log'

// 채널 빌드는 채널마다 profile 폴더와 Windows 작업 표시줄 묶음을 나누고, 같은 채널은 한 인스턴스만 띄운다.
// 두 인스턴스가 함께 뜨면 Alt+R 전역 단축키를 서로 가져간다.
const appIdentity = readAppIdentity()
let ownsInstance = true
if (appIdentity != null) {
  try {
    app.setPath('userData', join(app.getPath('appData'), appIdentity))
    app.setName(appIdentity)
    app.setAppUserModelId(appIdentity)
  } catch {
    app.exit(1)
  }
  ownsInstance = app.requestSingleInstanceLock()
  if (!ownsInstance) {
    app.quit()
  }
}

// 알림 상태는 창을 다시 만들어도 앱 실행 동안 유지한다. 확인은 배포 채널에서만 시작한다.
const updateNotices = createUpdateNotices({
  currentVersion: app.getVersion(),
  readFeed: (signal) => readReleaseFeed(fetchApi, signal),
  onFailure: reportDiagnostic
})
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  const shouldLoadDevUrl = is.dev && devUrl != null
  const entry = join(__dirname, '../frontend/index.html')
  const rendererDocumentUrl = shouldLoadDevUrl
    ? validateDevRendererUrl(devUrl)
    : pathToFileURL(entry).href
  if (mainWindow != null && !mainWindow.isDestroyed()) {
    throw new Error('Main window already exists.')
  }
  const window = new BrowserWindow({
    // 크기는 renderer가 보이는 화면에 맞춰 바꾸는 내용 높이와 같은 기준인 내용 크기다. 창은 파티 화면으로 연다.
    useContentSize: true,
    width: MAIN_WINDOW_SIZE.width,
    height: MAIN_WINDOW_SIZE.partyHeight,
    // dfragon-design layout.md의 최소 창 폭이다. 이 폭에서 상단 바는 제품 이름만 숨기면 Windows 창 버튼(138)과
    // 내비, 상태 칩, 도구 묶음이 겹치지 않고, 파티 카드 네 장이 한 줄에 들어간다.
    minWidth: MAIN_WINDOW_SIZE.minWidth,
    minHeight: MAIN_WINDOW_SIZE.partyHeight,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: getTitleBarOverlay(process.platform),
    backgroundColor: WINDOW_CHROME_COLORS.color,
    icon,
    webPreferences: {
      backgroundThrottling: false,
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  let disposeUpdateNotice: (() => void) | undefined
  let disposeShortcuts: (() => void) | undefined
  let disposeDiagnostics: (() => void) | undefined
  let disposeWindowChrome: (() => void) | undefined
  try {
    registerCapturePermissions(session.defaultSession)
    registerCaptureWindow(window, rendererDocumentUrl)
    disposeDiagnostics = registerDiagnosticsWindow({ window, documentUrl: rendererDocumentUrl })
    disposeShortcuts = registerDesktopShortcuts({
      window,
      rendererDocumentUrl,
      onUnavailable: () => reportDiagnostic('SHORTCUT_FAILED')
    })
    try {
      disposeUpdateNotice = registerUpdateNoticeWindow({
        window,
        documentUrl: rendererDocumentUrl,
        notices: updateNotices,
        onFailure: reportDiagnostic
      })
    } catch {
      // 새 버전 알림은 캡처 시작을 막지 않는다.
    }
    try {
      disposeWindowChrome = registerWindowChromeWindow({
        window,
        documentUrl: rendererDocumentUrl
      })
    } catch {
      // 창 색상 동기화는 캡처 시작을 막지 않는다.
    }

    window.on('ready-to-show', () => {
      window.show()
    })
    window.on('closed', () => {
      if (mainWindow === window) {
        mainWindow = null
      }
    })
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event) => event.preventDefault())
    const load = shouldLoadDevUrl ? window.loadURL(rendererDocumentUrl) : window.loadFile(entry)
    void load.catch(() => reportDiagnostic('MAIN_PROCESS_FAILED'))
  } catch (error) {
    disposeShortcuts?.()
    disposeDiagnostics?.()
    disposeWindowChrome?.()
    disposeUpdateNotice?.()
    window.destroy()
    throw error
  }

  mainWindow = window
}

function showOrCreateMainWindow(): void {
  const window = mainWindow
  if (window == null || window.isDestroyed()) {
    createWindow()

    return
  }

  if (window.isMinimized()) {
    window.restore()
  }
  window.show()
  window.focus()
}

app.whenReady().then(() => {
  if (!ownsInstance) {
    return
  }

  if (process.platform === 'darwin') {
    app.dock?.setIcon(icon)
  }

  const disposeMainDiagnostics = registerMainDiagnosticErrors()
  app.on('quit', disposeMainDiagnostics)

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const apiOrigin = readAppApiOrigin()
  const searchConfiguration =
    apiOrigin == null
      ? undefined
      : {
          apiOrigin,
          clock: createMonotonicClock(),
          portraitColorPolicy: INITIAL_PORTRAIT_COLOR_POLICY,
          score: createLazyScoreEngine(() =>
            loadScoreEngine({
              path: resolveScoreLibraryPath({
                isPackaged: app.isPackaged,
                platform: process.platform,
                resourcesPath: process.resourcesPath,
                appPath: app.getAppPath(),
                env: process.env
              })
            })
          )
        }
  const disposeCapture = registerCaptureIpc(searchConfiguration)
  app.on('quit', () => {
    disposeCapture()
  })
  if (readAppChannelName() === 'distribution') {
    updateNotices.start()
  }
  app.on('quit', updateNotices.dispose)

  createWindow()

  // 같은 채널을 다시 실행하면 새 인스턴스 대신 열린 창을 앞으로 가져온다.
  app.on('second-instance', () => {
    try {
      showOrCreateMainWindow()
    } catch {
      reportDiagnostic('MAIN_PROCESS_FAILED')
    }
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length > 0) {
      return
    }
    try {
      createWindow()
    } catch {
      reportDiagnostic('MAIN_PROCESS_FAILED')
    }
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
})

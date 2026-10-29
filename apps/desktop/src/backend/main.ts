import { app, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'node:url'
import { optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { validateDevRendererUrl } from './renderer-document'
import { registerCaptureIpc, registerCaptureWindow } from './capture/ipc-handler'
import { registerCapturePermissions } from './capture/permission-policy'
import { readAppApiOrigin, readAppChannelName, readAppIdentity } from './lib/app-channel'
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
    useContentSize: true,
    width: MAIN_WINDOW_SIZE.width,
    height: MAIN_WINDOW_SIZE.partyHeight,
    // 이 폭에서 상단 바는 제품 이름만 숨기면 Windows 창 버튼(138)과 내비, 상태 칩, 도구 묶음이
    // 겹치지 않고, 파티 카드 네 장이 한 줄에 들어간다.
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
    load.catch(() => reportDiagnostic('MAIN_PROCESS_FAILED'))
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

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const apiOrigin = readAppApiOrigin()
  const searchConfiguration =
    apiOrigin != null
      ? {
          apiOrigin,
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
      : undefined
  const disposeCapture = registerCaptureIpc(searchConfiguration)
  app.on('quit', () => {
    disposeCapture()
  })
  if (readAppChannelName() === 'distribution') {
    updateNotices.start()
  }
  app.on('quit', updateNotices.dispose)

  createWindow()

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

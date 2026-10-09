import { app, BrowserWindow, powerMonitor, session } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'node:url'
import { optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { validateDevRendererUrl } from './renderer-document'
import {
  collectCurrentCapture,
  registerCaptureIpc,
  registerCaptureWindow
} from './capture/ipc-handler'
import { registerCapturePermissions } from './capture/permission-policy'
import { registerAuthIpc } from './auth/ipc-handler'
import {
  attachProtocolIngressAfterStart,
  createProtocolIngress,
  isOrdinarySecondInstanceInvocation,
  selectProtocolIngressArguments
} from './auth/protocol-ingress'
import { bootstrapAuthRuntime, type AuthRuntime } from './auth/bootstrap'
import { createAuthAppLifecycle } from './auth/app-lifecycle'
import { createAuthRuntimeEffects } from './auth/runtime-effects'
import {
  applyAuthRuntimeProfile,
  AuthRuntimeProfileApplicationFailure
} from './auth/runtime-config'
import { readAppApiOrigin, readAppAuthConfig, readAppChannelName } from './auth/app-config'
import { registerDeveloperWindow } from './developer/ipc-handler'
import { registerVersionsWindow } from './versions/ipc-handler'
import { readDesktopBuildInfo } from './versions/desktop-info'
import { fetchApi } from './api-fetch'
import { readReleaseFeed } from './update-notice/http'
import { createUpdateNotices } from './update-notice/notices'
import { registerUpdateNoticeWindow } from './update-notice/ipc-handler'
import { INITIAL_PORTRAIT_EDGE_POLICY } from './search/portrait-policy'
import { registerDesktopShortcuts } from './shortcuts/register'
import { DESKTOP_SHORTCUTS } from '../preload/common/types/desktop-shortcut'
import { createOcrCollection } from './ocr-collection/collection'
import { isOcrCollectionEnabled } from './ocr-collection/policy'
import { registerDiagnosticsWindow } from './diagnostics/ipc-handler'
import { registerMainDiagnosticErrors, reportDiagnostic } from './diagnostics/log'
import {
  registerCharacterDetailWindows,
  openSelectedCharacterDetail
} from './character-detail/windows'

const parsedRuntimeConfig = readAppAuthConfig(app)
type RuntimeProfileState =
  | Readonly<{ status: 'inactive-config' }>
  | Readonly<{ status: 'preparation-failed' }>
  | Readonly<{ status: 'application-failed' }>
  | Readonly<{ status: 'applied'; config: NonNullable<typeof parsedRuntimeConfig> }>
const runtimeProfileState: RuntimeProfileState = (() => {
  if (parsedRuntimeConfig == null) {
    return { status: 'inactive-config' }
  }
  try {
    const appliedConfig = applyAuthRuntimeProfile(app, parsedRuntimeConfig)

    return { status: 'applied', config: appliedConfig }
  } catch (error) {
    const isApplicationFailure = error instanceof AuthRuntimeProfileApplicationFailure
    const status = isApplicationFailure ? 'application-failed' : 'preparation-failed'

    return { status }
  }
})()
const runtimeConfig = runtimeProfileState.status === 'applied' ? runtimeProfileState.config : null
const protocolIngress =
  runtimeConfig == null
    ? null
    : createProtocolIngress({
        app,
        argv: selectProtocolIngressArguments(process.argv, process.defaultApp === true),
        returnTarget: runtimeConfig.returnTarget
      })
const authAppLifecycle = createAuthAppLifecycle({
  app,
  ownsAuthProfile: () => protocolIngress?.ownsInstance === true,
  disposeProtocolIngress: () => protocolIngress?.dispose()
})

if (runtimeProfileState.status === 'application-failed') {
  app.exit(1)
}
// 알림 상태는 창을 다시 만들어도 앱 실행 동안 유지한다. 확인은 배포 채널에서만 시작한다.
const updateNotices = createUpdateNotices({
  currentVersion: app.getVersion(),
  readFeed: (signal) => readReleaseFeed(fetchApi, signal),
  onFailure: reportDiagnostic
})

function createWindow(authRuntime: AuthRuntime | null): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  const isDevelopment = is.dev
  const hasDevUrl = devUrl != null
  const shouldLoadDevUrl = isDevelopment && hasDevUrl
  const entry = join(__dirname, '../frontend/index.html')
  const rendererDocumentUrl = shouldLoadDevUrl
    ? validateDevRendererUrl(devUrl)
    : pathToFileURL(entry).href
  const previousWindow = authAppLifecycle.getWindow()
  const hasReusableWindow = previousWindow != null && !previousWindow.isDestroyed()
  if (hasReusableWindow) {
    throw new Error('Main window already exists.')
  }
  authAppLifecycle.prepareWindow()
  const window = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      backgroundThrottling: false,
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  let nextDisposeAuthIpc: (() => void) | undefined
  let disposeDeveloper: (() => void) | undefined
  let disposeVersions: (() => void) | undefined
  let disposeUpdateNotice: (() => void) | undefined
  let disposeCharacterDetails: (() => void) | undefined
  let disposeShortcuts: (() => void) | undefined
  let disposeDiagnostics: (() => void) | undefined
  try {
    registerCapturePermissions(session.defaultSession)
    registerCaptureWindow(window, rendererDocumentUrl)
    disposeDiagnostics = registerDiagnosticsWindow({ window, documentUrl: rendererDocumentUrl })
    disposeShortcuts = registerDesktopShortcuts({
      window,
      rendererDocumentUrl,
      onShortcut: (action) => {
        if (action === DESKTOP_SHORTCUTS.uploadCapture) {
          void collectCurrentCapture().catch(() => reportDiagnostic('UPLOAD_FAILED'))
        }
      },
      onUnavailable: () => reportDiagnostic('SHORTCUT_FAILED')
    })
    disposeCharacterDetails = registerCharacterDetailWindows({
      owner: window,
      entry: join(__dirname, '../frontend/character-detail.html'),
      preload: join(__dirname, '../preload/character-detail.js'),
      devUrl: shouldLoadDevUrl ? rendererDocumentUrl : undefined
    }).dispose
    disposeDeveloper = registerDeveloperWindow(
      window,
      rendererDocumentUrl,
      app.getPath('userData'),
      authRuntime?.coordinator
    )
    try {
      disposeVersions = registerVersionsWindow({
        window,
        documentUrl: rendererDocumentUrl,
        desktop: () => readDesktopBuildInfo(app.getVersion()),
        apiOrigin: readAppApiOrigin(),
        accountsOrigin: runtimeConfig?.apiOrigin ?? null
      })
    } catch {
      // Metadata availability does not control capture or authentication startup.
    }
    try {
      disposeUpdateNotice = registerUpdateNoticeWindow({
        window,
        documentUrl: rendererDocumentUrl,
        notices: updateNotices,
        onFailure: reportDiagnostic
      })
    } catch {
      // 새 버전 알림은 캡처와 로그인 시작을 막지 않는다.
    }
    if (authRuntime != null) {
      nextDisposeAuthIpc = registerAuthIpc({
        coordinator: authRuntime.coordinator,
        getWindow: () => {
          if (authAppLifecycle.getWindow() === window) {
            return window
          }

          return null
        },
        documentUrl: rendererDocumentUrl
      })
    }

    const observeLoad = authAppLifecycle.registerWindow(window)
    window.on('ready-to-show', () => {
      window.show()
    })

    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event) => event.preventDefault())
    const load = shouldLoadDevUrl ? window.loadURL(rendererDocumentUrl) : window.loadFile(entry)
    observeLoad(load)
  } catch (error) {
    disposeShortcuts?.()
    disposeDiagnostics?.()
    disposeCharacterDetails?.()
    disposeVersions?.()
    disposeUpdateNotice?.()
    disposeDeveloper?.()
    try {
      nextDisposeAuthIpc?.()
    } catch {
      // Continue rolling back the unpublished window.
    }
    authAppLifecycle.destroyWindow(window)
    throw error
  }

  authAppLifecycle.publishWindow(window, nextDisposeAuthIpc)
}

function showOrCreateMainWindow(authRuntime: AuthRuntime | null): void {
  const window = authAppLifecycle.getWindow()
  const hasWindow = window != null && !window.isDestroyed()
  if (!hasWindow) {
    createWindow(authRuntime)

    return
  }

  if (window.isMinimized()) {
    window.restore()
  }
  window.show()
  window.focus()
}

function activateWindowSafely(authRuntime: AuthRuntime | null): void {
  if (authAppLifecycle.isQuitting()) {
    return
  }

  try {
    showOrCreateMainWindow(authRuntime)
  } catch {
    return
  }
}

// This method will be called when Electron has finished initialization and is ready to create windows.
app.whenReady().then(async () => {
  if (runtimeProfileState.status === 'application-failed') {
    return
  }

  const hasOwnedInstance = protocolIngress == null || protocolIngress.ownsInstance
  if (!hasOwnedInstance) {
    return
  }

  if (process.platform === 'darwin') {
    app.dock?.setIcon(icon)
  }

  authAppLifecycle.registerAppHandlers()
  const disposeMainDiagnostics = registerMainDiagnosticErrors()
  app.on('quit', disposeMainDiagnostics)

  try {
    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    function composeAfterAuthBootstrap(authRuntime: AuthRuntime | null): void {
      const hasAuthRuntime = authRuntime != null
      if (!hasAuthRuntime) {
        authAppLifecycle.disposeExternalResources()
      }
      const apiOrigin = readAppApiOrigin()
      const searchConfiguration =
        apiOrigin == null
          ? undefined
          : {
              apiOrigin,
              clock: createAuthRuntimeEffects().createSearchClock(),
              portraitEdgeMatchPolicy: INITIAL_PORTRAIT_EDGE_POLICY
            }
      const collection = createOcrCollection({
        enabled: isOcrCollectionEnabled({ isPackaged: app.isPackaged, version: app.getVersion() }),
        onFailure: reportDiagnostic
      })
      const disposeCapture = registerCaptureIpc(
        searchConfiguration,
        { openSelected: openSelectedCharacterDetail },
        collection
      )
      app.on('quit', () => {
        disposeCapture()
      })
      if (readAppChannelName() === 'distribution') {
        updateNotices.start()
      }
      app.on('quit', updateNotices.dispose)

      createWindow(authRuntime)

      app.on('activate', function () {
        if (authAppLifecycle.isQuitting()) {
          return
        }

        try {
          // On macOS it's common to re-create a window in the app when the
          // dock icon is clicked and there are no other windows open.
          const hasNoOpenWindows = BrowserWindow.getAllWindows().length === 0
          if (hasNoOpenWindows) {
            createWindow(authRuntime)
          }
        } catch (error) {
          const ownsAuthProfile = protocolIngress?.ownsInstance === true
          if (ownsAuthProfile) {
            authAppLifecycle.exitAfterOwnedAuthFailure()

            return
          }
          throw error
        }
      })
      if (authRuntime == null) {
        app.on('second-instance', (_event, _commandLine, _workingDirectory, additionalData) => {
          const isOrdinaryInvocation =
            runtimeConfig == null ||
            isOrdinarySecondInstanceInvocation(additionalData, runtimeConfig.returnTarget)
          if (isOrdinaryInvocation) {
            activateWindowSafely(authRuntime)
          }
        })
      }
      app.on('window-all-closed', () => {
        const shouldQuit = process.platform !== 'darwin'
        if (shouldQuit) {
          app.quit()
        }
      })

      const startAuthRuntime = authRuntime?.start()
      void startAuthRuntime?.catch(authAppLifecycle.exitAfterOwnedAuthFailure)
      if (authRuntime != null && protocolIngress != null && startAuthRuntime != null) {
        attachProtocolIngressAfterStart(
          protocolIngress,
          startAuthRuntime,
          (rawReturnUrl) =>
            authAppLifecycle.runAfterQuitOutcome(() =>
              authRuntime.coordinator.handleReturnUrl(rawReturnUrl, () => {
                activateWindowSafely(authRuntime)
              })
            ),
          () => authAppLifecycle.canReceiveProtocolIngress(),
          () => authAppLifecycle.runAfterQuitOutcome(() => activateWindowSafely(authRuntime))
        )
      }
    }

    let authRuntime: AuthRuntime | null = null
    if (runtimeConfig != null) {
      const effects = createAuthRuntimeEffects({
        activateMainWindow: () => activateWindowSafely(authRuntime)
      })
      authAppLifecycle.setPowerMonitorDisposer(effects.bindPowerMonitor(powerMonitor))
      authRuntime = await authAppLifecycle.runBootstrap((isActive) =>
        bootstrapAuthRuntime({
          config: runtimeConfig,
          effects,
          isActive
        })
      )
      await authAppLifecycle.runAfterQuitOutcome(() => composeAfterAuthBootstrap(authRuntime))

      return
    }

    composeAfterAuthBootstrap(authRuntime)
  } catch (error) {
    if (authAppLifecycle.isShutdownCommitted()) {
      return
    }

    const ownsAuthProfile = protocolIngress?.ownsInstance === true
    if (ownsAuthProfile) {
      authAppLifecycle.exitAfterOwnedAuthFailure()

      return
    }

    if (authAppLifecycle.isQuitting()) {
      return
    }
    throw error
  }
})

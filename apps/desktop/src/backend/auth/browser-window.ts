import { randomUUID } from 'node:crypto'
import { BrowserWindow, session } from 'electron'
import type { AuthBrowser } from './types'

/** Remote authentication content has no preload, product IPC bridge or persistent session. */
export function createAuthBrowser(
  apiOrigin: string,
  returnTarget: string,
  activateMainWindow: () => void
): AuthBrowser {
  let managementWindow: BrowserWindow | null = null
  const allowed = (raw: string): boolean => {
    try {
      const url = new URL(raw)
      return (
        url.protocol === 'https:' && url.origin === apiOrigin && url.pathname.startsWith('/auth/')
      )
    } catch {
      return false
    }
  }
  return {
    async open(url, login) {
      if (!allowed(url) || login?.signal.aborted) {
        throw new Error('Authentication window unavailable')
      }
      if (!login && managementWindow && !managementWindow.isDestroyed()) {
        managementWindow.show()
        managementWindow.focus()
        return
      }
      const isolatedSession = session.fromPartition(`ldb-auth-${randomUUID()}`, { cache: false })
      isolatedSession.setPermissionRequestHandler((_contents, _permission, callback) =>
        callback(false)
      )
      isolatedSession.setPermissionCheckHandler(() => false)
      isolatedSession.on('will-download', (event) => event.preventDefault())
      isolatedSession.webRequest.onBeforeRequest((details, callback) => {
        callback({ cancel: !allowed(details.url) })
      })
      const window = new BrowserWindow({
        width: 540,
        height: 800,
        minWidth: 380,
        minHeight: 520,
        show: false,
        autoHideMenuBar: true,
        title: `LDB · ${new URL(apiOrigin).host}`,
        webPreferences: {
          session: isolatedSession,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
          webviewTag: false,
          devTools: false
        }
      })
      if (!login) {
        managementWindow = window
      }
      let claimed = false
      let loadFailed = false
      const close = (): void => {
        if (!window.isDestroyed()) {
          window.close()
        }
      }
      const navigate = (event: Electron.Event, target: string): void => {
        let callback = false
        try {
          const parsed = new URL(target)
          parsed.search = ''
          callback = parsed.href === returnTarget
        } catch {
          /* Invalid navigation is blocked below. */
        }
        if (callback && login) {
          event.preventDefault()
          void login
            .onReturn(target, () => {
              claimed = true
              activateMainWindow()
              close()
            })
            .catch(() => undefined)
        } else if (!allowed(target)) {
          event.preventDefault()
        }
      }
      window.webContents.on('will-navigate', navigate)
      window.webContents.on('will-redirect', navigate)
      window.webContents.on('will-frame-navigate', (event) => {
        if (!event.isMainFrame) {
          event.preventDefault()
        }
      })
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      window.webContents.on('will-attach-webview', (event) => event.preventDefault())
      window.on('page-title-updated', (event) => event.preventDefault())
      window.once('closed', () => {
        login?.signal.removeEventListener('abort', close)
        if (managementWindow === window) {
          managementWindow = null
        }
        if (login && !claimed && !loadFailed && !login.signal.aborted) {
          login.onClosed()
        }
        void isolatedSession.clearStorageData().catch(() => undefined)
      })
      login?.signal.addEventListener('abort', close, { once: true })
      if (login?.signal.aborted) {
        close()
        return
      }
      try {
        await window.loadURL(url)
        if (!window.isDestroyed()) {
          window.show()
          window.focus()
        }
      } catch {
        loadFailed = true
        close()
        throw new Error('Authentication window unavailable')
      }
    }
  }
}

import type { BrowserWindow } from 'electron'
import {
  DESKTOP_SHORTCUT_CHANNEL,
  DESKTOP_SHORTCUTS,
  type DesktopShortcut
} from '../../preload/common/types/desktop-shortcut'
import { createKeyboardShortcut } from '../lib/keyboard-shortcut'
import { isCurrentProcessForeground, isDnfForeground } from '../lib/win32-window-capture'

const VK_R = 0x52
const VK_SNAPSHOT = 0x2c

/** Routes foreground product hotkeys only to the live, trusted main document. */
export function registerDesktopShortcuts({
  window,
  rendererDocumentUrl,
  onShortcut,
  onUnavailable
}: {
  window: BrowserWindow
  rendererDocumentUrl: string
  onShortcut?: (shortcut: DesktopShortcut) => void
  onUnavailable?: () => void
}): () => void {
  let navigating = false
  let disposed = false
  const contents = window.webContents

  function isTrusted(): boolean {
    if (disposed || navigating || window.isDestroyed() || contents.isDestroyed()) {
      return false
    }
    const frame = contents.mainFrame

    return !frame.isDestroyed() && !frame.detached && frame.url === rendererDocumentUrl
  }

  const shortcut = createKeyboardShortcut({
    bindings: [
      { key: VK_R, shift: true, action: DESKTOP_SHORTCUTS.restartSearch },
      { key: VK_SNAPSHOT, shift: true, action: DESKTOP_SHORTCUTS.uploadCapture, releaseOnly: true }
    ],
    isForeground: () => isTrusted() && (isCurrentProcessForeground() || isDnfForeground())
  })

  function onNavigation(
    _event: Electron.Event,
    _url: string,
    inPlace: boolean,
    mainFrame: boolean
  ): void {
    if (mainFrame && !inPlace) {
      navigating = true
    }
  }

  function onNavigated(): void {
    navigating = false
  }

  function onRendererGone(): void {
    navigating = true
  }

  function dispose(): void {
    if (disposed) {
      return
    }
    disposed = true
    contents.removeListener('did-start-navigation', onNavigation)
    contents.removeListener('did-navigate', onNavigated)
    contents.removeListener('render-process-gone', onRendererGone)
    window.removeListener('closed', dispose)
    try {
      shortcut.unregister()
    } catch {
      onUnavailable?.()
    }
  }

  contents.on('did-start-navigation', onNavigation)
  contents.on('did-navigate', onNavigated)
  contents.on('render-process-gone', onRendererGone)
  window.once('closed', dispose)
  const registered = shortcut.register((action) => {
    if (isTrusted()) {
      onShortcut?.(action)
      contents.mainFrame.send(DESKTOP_SHORTCUT_CHANNEL, action)
    }
  })
  if (!registered && process.platform === 'win32') {
    onUnavailable?.()
  }

  return dispose
}

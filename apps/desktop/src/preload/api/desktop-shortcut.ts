import { ipcRenderer } from 'electron'
import {
  DESKTOP_SHORTCUT_CHANNEL,
  DESKTOP_SHORTCUTS,
  type DesktopShortcutApi
} from '../common/types/desktop-shortcut'

export const onDesktopShortcut: DesktopShortcutApi['onDesktopShortcut'] = (listener) => {
  const wrapper = (_event: Electron.IpcRendererEvent, value: unknown): void => {
    if (value === DESKTOP_SHORTCUTS.restartSearch || value === DESKTOP_SHORTCUTS.uploadCapture) {
      listener(value)
    }
  }
  ipcRenderer.on(DESKTOP_SHORTCUT_CHANNEL, wrapper)

  return () => ipcRenderer.removeListener(DESKTOP_SHORTCUT_CHANNEL, wrapper)
}

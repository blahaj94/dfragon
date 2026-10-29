import { ipcRenderer } from 'electron'
import {
  DESKTOP_SHORTCUT_CHANNEL,
  isDesktopShortcut,
  type DesktopShortcutApi
} from '../common/types/desktop-shortcut'

export const onDesktopShortcut: DesktopShortcutApi['onDesktopShortcut'] = (listener) => {
  const wrapper = (_event: Electron.IpcRendererEvent, value: unknown): void => {
    if (isDesktopShortcut(value)) {
      listener(value)
    }
  }
  ipcRenderer.on(DESKTOP_SHORTCUT_CHANNEL, wrapper)

  return () => ipcRenderer.removeListener(DESKTOP_SHORTCUT_CHANNEL, wrapper)
}

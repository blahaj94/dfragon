export const DESKTOP_SHORTCUT_CHANNEL = 'desktopShortcut'
export const DESKTOP_SHORTCUTS = {
  restartSearch: 'restart-search',
  uploadCapture: 'upload-capture'
} as const
export type DesktopShortcut = (typeof DESKTOP_SHORTCUTS)[keyof typeof DESKTOP_SHORTCUTS]
export type DesktopShortcutApi = {
  onDesktopShortcut: (listener: (shortcut: DesktopShortcut) => void) => () => void
}

export const DESKTOP_SHORTCUT_CHANNEL = 'desktopShortcut'
export const DESKTOP_SHORTCUTS = {
  restartSearch: 'restart-search',
  takeSnapshot: 'take-snapshot',
  copyClipboard: 'copy-clipboard'
} as const
export type DesktopShortcut = (typeof DESKTOP_SHORTCUTS)[keyof typeof DESKTOP_SHORTCUTS]
export type DesktopShortcutApi = {
  onDesktopShortcut: (listener: (shortcut: DesktopShortcut) => void) => () => void
}

export function isDesktopShortcut(value: unknown): value is DesktopShortcut {
  return Object.values<unknown>(DESKTOP_SHORTCUTS).includes(value)
}

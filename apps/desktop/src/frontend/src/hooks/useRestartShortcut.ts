import { useEffect } from 'react'

export function useRestartShortcut(enabled: boolean, startRound: () => void): void {
  useEffect(() => {
    if (!enabled || window.desktopShortcut === undefined) {
      return
    }

    return window.desktopShortcut.onDesktopShortcut((shortcut) => {
      if (shortcut === 'restart-search') {
        startRound()
      }
    })
  }, [enabled, startRound])
}

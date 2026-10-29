import { useEffect, useEffectEvent } from 'react'
import type { DesktopShortcut } from '../../../preload/common/types/desktop-shortcut'

export function useDesktopShortcut(
  shortcut: DesktopShortcut,
  enabled: boolean,
  action: () => void
): void {
  const onShortcut = useEffectEvent(action)

  useEffect(() => {
    if (!enabled) {
      return
    }

    return window.desktopShortcut.onDesktopShortcut((received) => {
      if (received === shortcut) {
        onShortcut()
      }
    })
  }, [shortcut, enabled])
}

import { useEffect } from 'react'

/**
 * Main이 전경 조건을 확인한 Alt+R 알림을 받아 회차 시작 함수를 부른다. 파티와 공대 화면은 각자 이 hook을 쓰고,
 * 지금 보이는 화면만 `enabled`로 받아 한 번의 Alt+R이 한 화면의 회차만 시작한다.
 */
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

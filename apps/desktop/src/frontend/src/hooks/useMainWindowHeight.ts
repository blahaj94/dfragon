import { useEffect } from 'react'
import type { WindowChromeApi } from '../../../preload/common/types/window-chrome'

function readBridge(): Pick<WindowChromeApi, 'setContentHeight'> | null {
  const candidate = typeof window === 'undefined' ? undefined : window.windowChrome

  if (candidate != null && typeof candidate.setContentHeight === 'function') {
    return candidate
  }

  return null
}

export function useMainWindowHeight(height: number): void {
  useEffect(() => {
    const bridge = readBridge()
    if (bridge == null) {
      return
    }
    void bridge.setContentHeight(height).catch(() => {
      // 창 높이를 바꾸지 못해도 화면은 그대로 쓸 수 있다. 다음에 화면을 바꿀 때 다시 맞춘다.
    })
  }, [height])
}

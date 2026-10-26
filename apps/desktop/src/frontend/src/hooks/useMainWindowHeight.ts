import { useEffect } from 'react'
import type { WindowChromeApi } from '../../../preload/common/types/window-chrome'

function readBridge(): Pick<WindowChromeApi, 'setContentHeight'> | null {
  const candidate = typeof window === 'undefined' ? undefined : window.windowChrome

  if (candidate != null && typeof candidate.setContentHeight === 'function') {
    return candidate
  }

  return null
}

/**
 * 메인 창의 내용 높이를 보이는 화면의 높이로 맞춘다. 처음 그릴 때와 높이가 바뀔 때마다 한 번 요청한다.
 * 창 높이 bridge가 없는 화면(브라우저 미리보기, 테스트)에서는 아무것도 하지 않는다.
 */
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

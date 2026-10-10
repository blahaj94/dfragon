import { useEffect } from 'react'
import type { WindowChromeApi } from '../../../preload/common/types/window-chrome'

function readBridge(): WindowChromeApi | null {
  const candidate = typeof window === 'undefined' ? undefined : window.windowChrome

  if (candidate != null && typeof candidate.setTheme === 'function') {
    return candidate
  }

  return null
}

/** 메인 창의 OS 창 버튼 배경과 기호 색을 현재 테마의 상단 바 색에 맞춘다. */
export function useWindowChromeTheme(light: boolean): void {
  useEffect(() => {
    const bridge = readBridge()
    if (bridge == null) {
      return
    }

    void bridge.setTheme(light ? 'light' : 'dark').catch(() => {
      // 창 버튼 색 동기화 실패는 화면 조작을 막지 않는다. 다음 테마 전환에서 다시 맞춘다.
    })
  }, [light])
}

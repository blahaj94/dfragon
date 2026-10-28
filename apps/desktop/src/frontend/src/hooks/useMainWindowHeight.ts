import { useEffect } from 'react'

export function useMainWindowHeight(height: number): void {
  useEffect(() => {
    window.windowChrome.setContentHeight(height).catch(() => {
      // 창 높이를 바꾸지 못해도 화면은 그대로 쓸 수 있다. 다음에 화면을 바꿀 때 다시 맞춘다.
    })
  }, [height])
}

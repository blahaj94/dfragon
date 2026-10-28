import type { TitleBarOverlay } from 'electron'
import { WINDOW_CHROME_COLORS, WINDOW_CHROME_HEIGHT } from '../../preload/common/window-chrome'

/**
 * macOS는 overlay 색을 바꿀 수 없고 신호등 버튼만 상단 바 높이의 가운데에 둔다.
 */
export function getTitleBarOverlay(platform: NodeJS.Platform): TitleBarOverlay {
  if (platform === 'darwin') {
    return { height: WINDOW_CHROME_HEIGHT }
  }

  return { ...WINDOW_CHROME_COLORS, height: WINDOW_CHROME_HEIGHT }
}

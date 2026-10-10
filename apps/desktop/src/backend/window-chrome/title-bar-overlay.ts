import type { TitleBarOverlay } from 'electron'
import {
  WINDOW_CHROME_COLORS,
  WINDOW_CHROME_HEIGHT,
  type WindowChromeTheme
} from '../../preload/common/window-chrome'

/** macOS는 overlay 색을 바꿀 수 없고 신호등 버튼만 상단 바 높이의 가운데에 둔다. */
export function canColorTitleBarOverlay(platform: NodeJS.Platform): boolean {
  return platform !== 'darwin'
}

/** 플랫폼과 테마에 맞춰 상단 바 안에 그릴 OS 창 버튼의 높이와 색을 정한다. */
export function getTitleBarOverlay(
  platform: NodeJS.Platform,
  theme: WindowChromeTheme
): TitleBarOverlay {
  if (!canColorTitleBarOverlay(platform)) {
    return { height: WINDOW_CHROME_HEIGHT }
  }

  return { ...WINDOW_CHROME_COLORS[theme], height: WINDOW_CHROME_HEIGHT }
}

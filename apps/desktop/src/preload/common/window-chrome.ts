export type WindowChromeTheme = 'light' | 'dark'

// @dfragon/ui tokens.css의 상단 바 면 bg.bar와 글자 fg.default 값이다. preload와 main은 CSS 변수를
// 읽을 수 없어 값을 옮겨 적으며, 토큰 값을 바꾸면 함께 고친다. 라이트 값은 provisional이다.
export const WINDOW_CHROME_COLORS = {
  dark: { color: '#121214', symbolColor: '#f1ede6' },
  light: { color: '#ffffff', symbolColor: '#1a1c20' }
} as const

export const WINDOW_CHROME_HEIGHT = 56

/** 창 색상에 허용된 테마만 변환 없이 확인한다. */
export function isWindowChromeTheme(value: unknown): value is WindowChromeTheme {
  return value === 'light' || value === 'dark'
}

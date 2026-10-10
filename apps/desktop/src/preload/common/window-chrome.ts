export type WindowChromeTheme = 'light' | 'dark'

// SEED @seed-design/css 2.7.0 base.css의 gray-200(dark), gray-00(light)은
// Desktop bg.surface, gray-1000은 fg.default에 대응한다.
export const WINDOW_CHROME_COLORS = {
  dark: { color: '#1d2025', symbolColor: '#f3f4f5' },
  light: { color: '#ffffff', symbolColor: '#1a1c20' }
} as const

export const WINDOW_CHROME_HEIGHT = 56

/** 창 색상에 허용된 테마만 변환 없이 확인한다. */
export function isWindowChromeTheme(value: unknown): value is WindowChromeTheme {
  return value === 'light' || value === 'dark'
}

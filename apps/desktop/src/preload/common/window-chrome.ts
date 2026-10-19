export type WindowChromeTheme = 'light' | 'dark'

// @dfragon/ui tokens.css의 상단 바 면 bg.bar와 글자 fg.default 값이다. preload와 main은 CSS 변수를
// 읽을 수 없어 값을 옮겨 적으며, 토큰 값을 바꾸면 함께 고친다. 라이트 값은 provisional이다.
export const WINDOW_CHROME_COLORS = {
  dark: { color: '#121214', symbolColor: '#f1ede6' },
  light: { color: '#ffffff', symbolColor: '#1a1c20' }
} as const

export const WINDOW_CHROME_HEIGHT = 56

// dfragon-design layout.md의 기준 창, 최소 창과 파티 카드를 접은 창의 높이다. 공대 카드를 접은 창 높이
// 560은 DFragon 디자인 캔버스 공대 보드의 값이다. 접은 높이는 최소 높이 640의 예외라, 접은 동안은 최소
// 높이를 접은 높이로 낮춘다.
export const MAIN_WINDOW_SIZE = {
  width: 1280,
  height: 800,
  minWidth: 1024,
  minHeight: 640,
  collapsedHeight: 400,
  raidCollapsedHeight: 560
} as const

// DFragon 디자인 캔버스 상세 창 보드의 패널 540 × 650을 창 내용 크기로 쓴다. 폭은 고정이고, 낮은 화면을
// 위해 높이는 장비 목록 몇 줄이 남는 480까지 줄일 수 있다(작업자가 정함).
export const DETAIL_WINDOW_SIZE = {
  width: 540,
  height: 650,
  minHeight: 480
} as const

// @dfragon/ui tokens.css의 카드 면 card.bg 값이다. 상세 창은 테마와 관계없이 다크 카드 면이라 창 배경도
// 이 색이며, 토큰 값을 바꾸면 함께 고친다.
export const DETAIL_WINDOW_BACKGROUND = '#17171a'

/** 창 색상에 허용된 테마만 변환 없이 확인한다. */
export function isWindowChromeTheme(value: unknown): value is WindowChromeTheme {
  return value === 'light' || value === 'dark'
}

/** 메인 창 내용 높이로 접은 높이와 기준 높이 사이의 정수만 변환 없이 허용한다. */
export function isMainWindowContentHeight(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MAIN_WINDOW_SIZE.collapsedHeight &&
    value <= MAIN_WINDOW_SIZE.height
  )
}

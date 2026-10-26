// @dfragon/ui tokens.css의 다크 상단 바 면 bg.bar와 글자 fg.default 값이다. Desktop은 다크 테마만 쓴다.
// preload와 main은 CSS 변수를 읽을 수 없어 값을 옮겨 적으며, 토큰 값을 바꾸면 함께 고친다.
export const WINDOW_CHROME_COLORS = { color: '#121214', symbolColor: '#f1ede6' } as const

// 상단 바(TopBar) 높이 44와 같다. OS 창 버튼이 상단 바 높이에 맞춰 그려진다.
export const WINDOW_CHROME_HEIGHT = 44

// DFragon 디자인 캔버스 축소 시안의 창 크기다. 폭은 1280 기준이고 더 넓으면 카드가 늘어난다. 내용 높이는
// 보이는 화면이 정한다(파티 163, 공대 300). 창은 파티 화면으로 열리고, 최소 높이는 파티 높이다.
export const MAIN_WINDOW_SIZE = {
  width: 1280,
  minWidth: 1024,
  partyHeight: 163,
  raidHeight: 300
} as const

/** 메인 창 내용 높이로 파티 높이와 공대 높이 사이의 정수만 변환 없이 허용한다. */
export function isMainWindowContentHeight(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MAIN_WINDOW_SIZE.partyHeight &&
    value <= MAIN_WINDOW_SIZE.raidHeight
  )
}

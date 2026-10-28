// preload와 main은 CSS 변수를 읽을 수 없어 값을 옮겨 적으며, 토큰 값을 바꾸면 함께 고친다.
export const WINDOW_CHROME_COLORS = { color: '#121214', symbolColor: '#f1ede6' } as const

// 상단 바(TopBar) 높이 44와 같다. OS 창 버튼이 상단 바 높이에 맞춰 그려진다.
export const WINDOW_CHROME_HEIGHT = 44

export const MAIN_WINDOW_SIZE = {
  width: 1280,
  minWidth: 1024,
  partyHeight: 163,
  raidHeight: 300
} as const

export function isMainWindowContentHeight(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MAIN_WINDOW_SIZE.partyHeight &&
    value <= MAIN_WINDOW_SIZE.raidHeight
  )
}

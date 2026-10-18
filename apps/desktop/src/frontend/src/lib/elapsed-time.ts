const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const UNITS = [
  { size: DAY, unit: '일' },
  { size: HOUR, unit: '시간' },
  { size: MINUTE, unit: '분' },
  { size: SECOND, unit: '초' }
] as const

export type ElapsedTime = { value: number; unit: (typeof UNITS)[number]['unit'] }

// 지난 시간을 `12초 전`처럼 가장 큰 단위 하나의 내림 값으로 나눈다. 시계가 뒤로 가 음수가 되면 0초로 본다.
export function toElapsedTime(elapsedMs: number): ElapsedTime {
  const elapsed = Math.max(0, elapsedMs)
  const { size, unit } = UNITS.find((candidate) => elapsed >= candidate.size) ?? UNITS[3]
  const value = Math.floor(elapsed / size)

  return { value, unit }
}

// 표시 값이 다음으로 바뀔 때까지 남은 시간(ms)이다. 초 단위 동안만 1초마다 다시 그리고, 분 이상은 그
// 단위가 바뀔 때만 다시 그려 렌더 횟수를 줄인다.
export function getElapsedTimeRefreshDelay(elapsedMs: number): number {
  const elapsed = Math.max(0, elapsedMs)
  const { size } = UNITS.find((candidate) => elapsed >= candidate.size) ?? UNITS[3]

  return size - (elapsed % size)
}

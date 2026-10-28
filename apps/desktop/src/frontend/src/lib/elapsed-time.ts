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

export function toElapsedTime(elapsedMs: number): ElapsedTime {
  const elapsed = Math.max(0, elapsedMs)
  const { size, unit } = UNITS.find((candidate) => elapsed >= candidate.size) ?? UNITS[3]
  const value = Math.floor(elapsed / size)

  return { value, unit }
}

export function getElapsedTimeRefreshDelay(elapsedMs: number): number {
  const elapsed = Math.max(0, elapsedMs)
  const { size } = UNITS.find((candidate) => elapsed >= candidate.size) ?? UNITS[3]

  return size - (elapsed % size)
}

const DAY_MS = 24 * 60 * 60 * 1000
// 한국 표준시는 서머타임이 없어 늘 UTC+9다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export function averageGradePercent(values: readonly number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0)

  return Math.round(total / values.length)
}

export function nextGradeResetAt(now: Date): Date {
  const kstDays = Math.floor((now.getTime() + KST_OFFSET_MS) / DAY_MS)

  return new Date((kstDays + 1) * DAY_MS - KST_OFFSET_MS)
}

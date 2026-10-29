import { isRecord } from '@dfragon/lib/utils/shape-check'
import type { TodayGrade } from './types/today-grade'

function isPercent(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

export function parseTodayGrade(value: unknown): TodayGrade | null {
  if (!isRecord(value) || !isPercent(value.percent) || !isTimestamp(value.expiresAt)) {
    return null
  }

  return { percent: value.percent, expiresAt: value.expiresAt }
}

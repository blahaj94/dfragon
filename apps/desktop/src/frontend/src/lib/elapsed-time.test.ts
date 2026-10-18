import { expect, it } from 'vitest'
import { toElapsedTime, getElapsedTimeRefreshDelay } from './elapsed-time'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

it.each([
  [0, 0, '초'],
  [12_400, 12, '초'],
  [59_999, 59, '초'],
  [MINUTE, 1, '분'],
  [59 * MINUTE + 59 * SECOND, 59, '분'],
  [HOUR, 1, '시간'],
  [23 * HOUR + 59 * MINUTE, 23, '시간'],
  [24 * HOUR, 1, '일'],
  [-5 * SECOND, 0, '초']
])('지난 %ims는 가장 큰 단위 하나의 내림 값 %i%s다', (elapsed, value, unit) => {
  expect(toElapsedTime(elapsed)).toEqual({ value, unit })
})

it.each([
  [0, SECOND],
  [12_400, 600],
  [59_500, 500],
  [MINUTE, MINUTE],
  [MINUTE + 30 * SECOND, 30 * SECOND],
  [HOUR + MINUTE, 59 * MINUTE],
  [-5 * SECOND, SECOND]
])('지난 %ims의 표시는 %ims 뒤에 바뀐다', (elapsed, delay) => {
  expect(getElapsedTimeRefreshDelay(elapsed)).toBe(delay)
})

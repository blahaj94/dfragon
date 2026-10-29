import { expect, it } from 'vitest'
import { readTimeOfDay, type TimeOfDay } from './time-of-day'

it.each<[number, TimeOfDay]>([
  [0, 'night'],
  [3, 'night'],
  [4, 'dawn'],
  [5, 'dawn'],
  [6, 'day'],
  [11, 'day'],
  [12, 'afternoon'],
  [17, 'afternoon'],
  [18, 'dawn'],
  [21, 'dawn'],
  [22, 'night'],
  [23, 'night']
])('%i시는 %s 아이콘을 쓴다', (hour, expected) => {
  expect(readTimeOfDay(hour)).toBe(expected)
})

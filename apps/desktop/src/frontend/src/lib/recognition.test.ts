import { expect, it } from 'vitest'
import { hasColorMatch } from './recognition'

it('허용 오차 안의 색상만 인정한다', () => {
  expect(hasColorMatch([[101, 149, 201]], [100, 150, 200], 1)).toBe(true)
  expect(hasColorMatch([[103, 150, 200]], [100, 150, 200], 1)).toBe(false)
})

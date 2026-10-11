import { expect, it } from 'vitest'
import { hasColorMatch, normalizeNickname } from './recognition'

it('한글, 영문, 숫자 nickname 문자만 남긴다', () => {
  expect(normalizeNickname(' 테-스_트! ABC 123 ')).toBe('테스트ABC123')
})

it('허용 오차 안의 색상만 인정한다', () => {
  expect(hasColorMatch([[101, 149, 201]], [100, 150, 200], 1)).toBe(true)
  expect(hasColorMatch([[103, 150, 200]], [100, 150, 200], 1)).toBe(false)
})

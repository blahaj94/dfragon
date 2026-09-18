import { expect, it } from 'vitest'
import { validManualNickname } from '../../lib/manual-input'

it.each(['가', '漢', '𠀀', '😀', '♥'])('validates 2–12 Unicode code points for %s', (character) => {
  expect(validManualNickname(character)).toBe(false)
  expect(validManualNickname(character.repeat(2))).toBe(true)
  expect(validManualNickname(character.repeat(12))).toBe(true)
  expect(validManualNickname(character.repeat(13))).toBe(false)
})

it('keeps the API code-point contract for decomposed text and emoji sequences', () => {
  expect(validManualNickname('가'.repeat(12))).toBe(true)
  expect(validManualNickname('가'.repeat(12).normalize('NFD'))).toBe(false)
  expect(validManualNickname('👩‍💻'.repeat(4))).toBe(true)
  expect(validManualNickname('👩‍💻'.repeat(5))).toBe(false)
})

it.each(['\ud800가', '가\udfff', ' 가나', '가나 '])(
  'rejects malformed or padded input %j',
  (nickname) => {
    expect(validManualNickname(nickname)).toBe(false)
  }
)

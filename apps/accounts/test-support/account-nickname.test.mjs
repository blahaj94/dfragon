import assert from 'node:assert/strict'
import { test } from 'node:test'
import process from 'node:process'

test('닉네임은 trim 뒤 1~20 grapheme을 허용하고 Unicode 원문을 보존한다', async (t) => {
  const { validateNickname } = await import('../dist/auth/account/nickname.js')
  t.diagnostic(
    `Node ${process.version}; Unicode ${process.versions.unicode}; ICU ${process.versions.icu}`
  )
  const allowed = [
    ['  모험가  ', '모험가'],
    ['\u00a0e\u0301\u00a0', 'e\u0301'],
    ['👩🏽‍🚀'.repeat(20), '👩🏽‍🚀'.repeat(20)],
    ['🇰🇷'.repeat(20), '🇰🇷'.repeat(20)],
    ['가'.repeat(20), '가'.repeat(20)],
    ['✈️ a  b <>&', '✈️ a  b <>&'],
    ['A\u0301\u0308', 'A\u0301\u0308'],
    ['  Ａ  ', 'Ａ'],
    ['é', 'é'],
    ['e\u0301', 'e\u0301'],
    ['𠮷', '𠮷']
  ]
  for (const [input, expected] of allowed) {
    assert.equal(validateNickname(input), expected)
  }
})

test('닉네임은 trim 전 제어 문자, 깨진 UTF-16, 빈 값, 21 grapheme을 거절한다', async () => {
  const { validateNickname } = await import('../dist/auth/account/nickname.js')
  const invalid = [
    undefined,
    null,
    1,
    true,
    [],
    {},
    '',
    '   ',
    '\u00a0',
    '\ud800',
    '\udc00',
    'a\ud800b',
    '\udc00\ud800',
    '\ta',
    'a\n',
    '\ra',
    '\u0000a',
    '\u0085a',
    '\u009fa',
    '\u2028a',
    'a\u2029',
    'a'.repeat(21),
    '👩🏽‍🚀'.repeat(21)
  ]
  for (const input of invalid) {
    assert.throws(
      () => validateNickname(input),
      (error) => {
        assert.equal(error.code, 'INVALID_NICKNAME')
        assert.equal(error.status, 400)
        assert.equal(error.message, '닉네임을 확인해 주세요.')
        assert.equal(error.cause, undefined)

        return true
      }
    )
  }
})

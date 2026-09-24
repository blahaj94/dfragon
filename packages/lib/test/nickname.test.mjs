import assert from 'node:assert/strict'
import test from 'node:test'
import iconv from 'iconv-lite'
import { validateDFNickname } from '@dfragon/lib'
import { cp949Characters } from '../dist/cp949-characters.js'

test('ASCII, Hangul, Japanese and legacy symbols count as CP949 bytes', () => {
  for (const nickname of [
    '★검신★',
    '가나다라마바',
    'Ab0123456789',
    '가나다라마12',
    'アラド',
    '사쿠라',
    'ㄱ검신',
    '검신♡',
    'A$'
  ]) {
    assert.deepEqual(validateDFNickname(nickname), { isValid: true }, nickname)
  }
  for (const [nickname, bytes] of [
    ['가나다라마바A', 13],
    ['Ab01234567890', 13],
    ['가나다라마바사', 14]
  ]) {
    assert.deepEqual(validateDFNickname(nickname), {
      isValid: false,
      reason: `글자수 제한을 초과했습니다. (현재 ${bytes}B / 최대 12B)`
    })
  }
})

test('rejects whitespace, controls, invisible characters and invalid UTF-16 without normalization', () => {
  for (const nickname of [
    '',
    ' ',
    '\t\n',
    '검 신',
    ' 검신',
    '검신 ',
    '검신\n',
    '검\t신',
    '검\u00a0신',
    '검\u3000신',
    '검\u0085신',
    '검\u0000신',
    '검\u007f신',
    '검\u200b신',
    '검\u200d신',
    '검\u3164신',
    '\ud800',
    '\udc00',
    '가'
  ]) {
    assert.equal(validateDFNickname(nickname).isValid, false, JSON.stringify(nickname))
  }
})

test('rejects unencodable Unicode, including emoji outside the original blacklist', () => {
  for (const nickname of [
    '사쿠라🌸',
    '검신🫠',
    '검신🚀',
    '검신🇰🇷',
    '검신1️⃣',
    '검신♥️',
    '𠀀',
    '龥'
  ]) {
    assert.equal(validateDFNickname(nickname).isValid, false, nickname)
  }
})

test('banned words are explicit caller policy, ignore empty entries and match case insensitively', () => {
  for (const nickname of ['운영자', '세리아', '단진']) {
    assert.equal(validateDFNickname(nickname).isValid, true)
    assert.deepEqual(validateDFNickname(nickname, { bannedWords: ['운영자', '세리아', '단진'] }), {
      isValid: false,
      reason: '사용할 수 없는 단어가 포함되어 있습니다.'
    })
  }
  assert.equal(validateDFNickname('MyGM', { bannedWords: ['gm'] }).isValid, false)
  assert.equal(validateDFNickname('Mygm', { bannedWords: ['GM'] }).isValid, false)
  assert.equal(validateDFNickname('검신', { bannedWords: [''] }).isValid, true)
})

test('generated membership exactly matches lossless CP949 encoding across BMP', () => {
  const table = new Set(cp949Characters)
  for (let code = 0x80; code <= 0xffff; code++) {
    const character = String.fromCharCode(code)
    const bytes = iconv.encode(character, 'cp949')
    const representable = bytes.length === 2 && iconv.decode(bytes, 'cp949') === character
    const included = (code >= 0xac00 && code <= 0xd7a3) || table.has(character)
    assert.equal(included, representable, `U+${code.toString(16)}`)
  }
})

test('corrects supplied examples that are not representable in CP949', () => {
  assert.deepEqual(validateDFNickname('★검신★'), { isValid: true })
  assert.equal(validateDFNickname('검신〆').isValid, false)
  assert.equal(validateDFNickname('아라드郎').isValid, false)
  assert.deepEqual(validateDFNickname('아라드郞'), { isValid: true })
  assert.equal(validateDFNickname('사쿠라🌸').isValid, false)
})

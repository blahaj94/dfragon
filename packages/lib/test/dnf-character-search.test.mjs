import assert from 'node:assert/strict'
import test from 'node:test'
import { matchesDNFSearchNicknamePolicy, DNF_SEARCH_NICKNAME_LIMITS } from '@dfragon/lib'

const TITLES = {
  lengthLimits: '검색어는 바이트·UTF-16 단위 대신 Unicode code point로 2~12개를 센다',
  preservedUnicode: '정규화·내부 공백·결합 sequence의 원문 code point 수를 유지한다',
  trimWhitespace: 'ECMAScript trim 공백은 앞뒤에서 거절하고 내부에서는 허용한다',
  trimDifference: 'trim 대상이 아닌 Unicode 공백·format 문자를 별도 금지하지 않는다',
  generatedCodePoints: '문자군을 섞은 유한한 조합도 grapheme 수가 아닌 code point 경계를 지킨다'
}

test(TITLES.lengthLimits, () => {
  assert.deepEqual(DNF_SEARCH_NICKNAME_LIMITS, { minimumCodePoints: 2, maximumCodePoints: 12 })
  assert.equal(matchesDNFSearchNicknamePolicy(''), false)
  for (const character of ['가', '漢', '𠀀', '😀', '♥']) {
    for (const [length, allowed] of [
      [1, false],
      [2, true],
      [12, true],
      [13, false]
    ]) {
      assert.equal(matchesDNFSearchNicknamePolicy(character.repeat(length)), allowed)
    }
  }
})

test(TITLES.preservedUnicode, () => {
  assert.equal(matchesDNFSearchNicknamePolicy('가'.repeat(12).normalize('NFD')), false)
  assert.equal(matchesDNFSearchNicknamePolicy('가'), true)
  assert.equal(matchesDNFSearchNicknamePolicy('👩‍💻'.repeat(4)), true)
  assert.equal(matchesDNFSearchNicknamePolicy('👩‍💻'.repeat(5)), false)
  assert.equal(matchesDNFSearchNicknamePolicy('가 나'), true)
  for (const nickname of [' 가나', '가나 ', '\u00a0가나', '가나\u3000']) {
    assert.equal(matchesDNFSearchNicknamePolicy(nickname), false)
  }
})

test(TITLES.trimWhitespace, () => {
  const trimCodePoints = [
    0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x00a0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003,
    0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
    0xfeff
  ]

  for (const code of trimCodePoints) {
    const whitespace = String.fromCodePoint(code)
    const label = `공백 U+${code.toString(16)}`
    assert.equal(matchesDNFSearchNicknamePolicy(whitespace + '가나'), false, `${label}: 앞`)
    assert.equal(matchesDNFSearchNicknamePolicy('가나' + whitespace), false, `${label}: 뒤`)
    assert.equal(matchesDNFSearchNicknamePolicy(whitespace.repeat(2)), false, `${label}: 빈 검색어`)
    assert.equal(matchesDNFSearchNicknamePolicy('가' + whitespace + '나'), true, `${label}: 내부`)
  }
})

test(TITLES.trimDifference, () => {
  // CP949 이름 검사·계정 validator의 문자 제한을 길이/trim 전용 검색 helper에 옮기지 않는다.
  for (const character of ['\u0085', '\u180e', '\u200b']) {
    for (const nickname of [character + '가', '가' + character, '가' + character + '나']) {
      assert.equal(matchesDNFSearchNicknamePolicy(nickname), true, JSON.stringify(nickname))
    }
  }
})

test(TITLES.generatedCodePoints, () => {
  // 각 항목은 정확히 한 code point다. 결합 문자·ZWJ·variation selector도 길이에 포함된다.
  const atoms = ['A', '가', '𠀀', '😀', '\u0301', '\u200d', '\ufe0f']
  for (let length = 0; length <= 13; length++) {
    for (let offset = 0; offset < atoms.length; offset++) {
      const nickname = Array.from(
        { length },
        (_, index) => atoms[(index + offset) % atoms.length]
      ).join('')
      const allowed = length >= 2 && length <= 12
      assert.equal(
        matchesDNFSearchNicknamePolicy(nickname),
        allowed,
        `${length} code point, 시작 문자 ${offset}: ${JSON.stringify(nickname)}`
      )
    }
  }
})

import assert from 'node:assert/strict'
import test from 'node:test'
import iconv from 'iconv-lite'
import { validateDFNickname } from '@dfragon/lib'
import { cp949Characters } from '../dist/cp949-characters.js'

const TITLES = {
  byteLengths: 'ASCII는 1B, 한글, 일본어, 고전 기호는 2B로 계산해 최대 12B를 허용한다',
  mixedByteLengths: '문자군을 섞은 조합도 순서와 무관하게 CP949의 12B 경계를 지킨다',
  rejectedCharacters:
    '빈 값, Unicode 공백, 제어문자, 보이지 않는 문자, 잘못된 UTF-16을 구분해 거절한다',
  unencodable: '기존 이모지 차단 목록 밖의 문자도 CP949로 표현할 수 없으면 거절한다',
  errorPriority: '여러 오류가 겹치면 빈 값, 공백, 문자 집합, 바이트 길이, 금칙어 순서로 보고한다',
  bannedWords: '금칙어는 호출자 정책으로만 적용하며 빈 항목을 무시하고 대소문자 없이 부분 일치한다',
  bannedWordsImmutability: '읽기 전용 금칙어 목록을 변경하거나 다음 호출의 정책으로 남기지 않는다',
  normalization: 'NFC, NFKC 정규화로 원문의 문자 집합이나 바이트 길이를 바꾸지 않는다',
  codecMembership: '생성 문자 집합은 BMP 전체에서 손실 없는 CP949 인코딩과 일치한다',
  knownExamples: '모양이 비슷해도 CP949로 표현할 수 없는 제공 예시는 거절한다'
}
const invalidCharacterReason =
  '공백, 제어문자, 보이지 않는 문자와 CP949로 표현할 수 없는 문자는 사용할 수 없습니다.'

test(TITLES.byteLengths, () => {
  for (const nickname of [
    '!',
    'A',
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

test(TITLES.mixedByteLengths, () => {
  const asciiCharacters = ['A', '0', '$', '~']
  const legacyCharacters = ['가', '힣', 'ア', '郞', '★', '♡', 'ㄱ']

  // 유한한 조합을 codec으로 따로 계산하여 UTF-16, UTF-8 길이와 혼동하는 회귀를 잡는다.
  for (let asciiCount = 0; asciiCount <= 13; asciiCount++) {
    for (let legacyCount = 0; legacyCount <= 7; legacyCount++) {
      if (asciiCount + legacyCount === 0) {
        continue
      }
      const ascii = Array.from(
        { length: asciiCount },
        (_, index) => asciiCharacters[index % asciiCharacters.length]
      ).join('')
      const legacy = Array.from(
        { length: legacyCount },
        (_, index) => legacyCharacters[index % legacyCharacters.length]
      ).join('')
      for (const nickname of [ascii + legacy, legacy + ascii]) {
        const bytes = iconv.encode(nickname, 'cp949').length
        if (bytes <= 12) {
          assert.deepEqual(validateDFNickname(nickname), { isValid: true }, nickname)
        } else {
          assert.deepEqual(
            validateDFNickname(nickname),
            {
              isValid: false,
              reason: `글자수 제한을 초과했습니다. (현재 ${bytes}B / 최대 12B)`
            },
            nickname
          )
        }
      }
    }
  }
})

test(TITLES.rejectedCharacters, () => {
  const cases = [
    {
      name: '빈 값 또는 trim 후 빈 값',
      nicknames: ['', ' ', '\t\n', '\u00a0\u3000', '\ufeff'],
      reason: '닉네임을 입력해 주세요.'
    },
    {
      name: '앞뒤 또는 내부 Unicode 공백',
      nicknames: [
        '검 신',
        ' 검신',
        '검신 ',
        '검신\n',
        '검\t신',
        '검\u00a0신',
        '검\u3000신',
        '검\u0085신'
      ],
      reason: '공백(띄어쓰기)은 포함할 수 없습니다.'
    },
    {
      name: '제어문자, format, default-ignorable, 단독 surrogate, 분해 한글',
      nicknames: [
        '검\u0000신',
        '검\u007f신',
        '검\u200b신',
        '검\u200d신',
        '검\u00ad신',
        '검\u3164신',
        '검\u115f신',
        '\ud800',
        '\udc00',
        '가'
      ],
      reason: invalidCharacterReason
    }
  ]

  for (const { name, nicknames, reason } of cases) {
    for (const nickname of nicknames) {
      assert.deepEqual(
        validateDFNickname(nickname),
        { isValid: false, reason },
        `${name}: ${JSON.stringify(nickname)}`
      )
    }
  }
})

test(TITLES.unencodable, () => {
  for (const nickname of ['사쿠라🌸', '검신🫠', '검신🚀', '검신🇰🇷', '검신1️⃣', '검신♥️', '𠀀', '龥']) {
    assert.deepEqual(
      validateDFNickname(nickname),
      { isValid: false, reason: invalidCharacterReason },
      nickname
    )
  }
})

test(TITLES.errorPriority, () => {
  const options = { bannedWords: Object.freeze(['gm']) }
  const cases = [
    [' \t\n', '닉네임을 입력해 주세요.'],
    ['MyGM 가가가가🫠', '공백(띄어쓰기)은 포함할 수 없습니다.'],
    ['MyGM가가가가🫠', invalidCharacterReason],
    ['A'.repeat(13) + '🫠', invalidCharacterReason],
    ['MyGM가나다라마', '글자수 제한을 초과했습니다. (현재 14B / 최대 12B)'],
    ['MyGM', '사용할 수 없는 단어가 포함되어 있습니다.']
  ]

  for (const [nickname, reason] of cases) {
    assert.deepEqual(validateDFNickname(nickname, options), { isValid: false, reason }, nickname)
  }
})

test(TITLES.bannedWords, () => {
  for (const nickname of ['운영자', '세리아', '단진']) {
    assert.deepEqual(validateDFNickname(nickname), { isValid: true })
    assert.deepEqual(validateDFNickname(nickname, { bannedWords: ['운영자', '세리아', '단진'] }), {
      isValid: false,
      reason: '사용할 수 없는 단어가 포함되어 있습니다.'
    })
  }
  for (const [nickname, word] of [
    ['MyGM', 'gm'],
    ['Mygm', 'GM'],
    ['xGMx', 'gm'],
    ['GMname', 'gm'],
    ['nameGM', 'gm']
  ]) {
    assert.deepEqual(validateDFNickname(nickname, { bannedWords: [word] }), {
      isValid: false,
      reason: '사용할 수 없는 단어가 포함되어 있습니다.'
    })
  }
  assert.deepEqual(validateDFNickname('검신', { bannedWords: [''] }), { isValid: true })
})

test(TITLES.bannedWordsImmutability, () => {
  const bannedWords = Object.freeze(['GM', '', '운영자'])
  const options = Object.freeze({ bannedWords })

  assert.deepEqual(validateDFNickname('Mygm', options), {
    isValid: false,
    reason: '사용할 수 없는 단어가 포함되어 있습니다.'
  })
  assert.deepEqual(validateDFNickname('검신', options), { isValid: true })
  assert.deepEqual(bannedWords, ['GM', '', '운영자'])
  assert.equal(options.bannedWords, bannedWords)
  assert.deepEqual(validateDFNickname('Mygm'), { isValid: true })
  assert.deepEqual(validateDFNickname('Mygm', { bannedWords: ['다른말'] }), { isValid: true })
})

test(TITLES.normalization, () => {
  const decomposed = '가'.normalize('NFD')
  const fullwidth = 'Ａ'.repeat(7)

  assert.deepEqual(validateDFNickname(decomposed), {
    isValid: false,
    reason: invalidCharacterReason
  })
  assert.deepEqual(validateDFNickname(decomposed.normalize('NFC')), { isValid: true })
  assert.deepEqual(validateDFNickname(fullwidth), {
    isValid: false,
    reason: '글자수 제한을 초과했습니다. (현재 14B / 최대 12B)'
  })
  assert.deepEqual(validateDFNickname(fullwidth.normalize('NFKC')), { isValid: true })
})

test(TITLES.codecMembership, () => {
  const table = new Set(cp949Characters)
  for (let code = 0x80; code <= 0xffff; code++) {
    const character = String.fromCharCode(code)
    const bytes = iconv.encode(character, 'cp949')
    const representable = bytes.length === 2 && iconv.decode(bytes, 'cp949') === character
    const included = (code >= 0xac00 && code <= 0xd7a3) || table.has(character)
    assert.equal(included, representable, `U+${code.toString(16)}`)
  }
})

test(TITLES.knownExamples, () => {
  assert.deepEqual(validateDFNickname('★검신★'), { isValid: true })
  assert.deepEqual(validateDFNickname('검신〆'), {
    isValid: false,
    reason: invalidCharacterReason
  })
  assert.deepEqual(validateDFNickname('아라드郎'), {
    isValid: false,
    reason: invalidCharacterReason
  })
  assert.deepEqual(validateDFNickname('아라드郞'), { isValid: true })
  assert.deepEqual(validateDFNickname('사쿠라🌸'), {
    isValid: false,
    reason: invalidCharacterReason
  })
})

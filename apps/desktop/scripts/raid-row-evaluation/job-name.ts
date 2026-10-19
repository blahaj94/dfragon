const AWAKENING_MARK_PATTERN = /^\s*眞/u
const NON_HANGUL_SYLLABLE_PATTERN = /[^가-힣]/gu
// 1067×600 표본에서 돋보기 앞에서 잘린 직업명은 4~5자가 보였다. 이보다 짧은 앞부분은 다른 직업과 겹치기 쉽다.
const CLIPPED_MIN_LENGTH = 4

export type JobNameMatch = 'exact' | 'clipped-prefix'

/**
 * 앞의 `眞` 표식을 지우고 한글 음절만 남겨, 화면 문자열과 API의 `jobGrowName`을 같은 형태로 맞춘다.
 * 직업명은 한글뿐이므로 공백과, 잘린 글자를 OCR이 영문이나 기호로 읽은 부분도 함께 빠진다.
 */
export function normalizeJobName(text: string): string {
  return text
    .normalize('NFC')
    .replace(AWAKENING_MARK_PATTERN, '')
    .replace(NON_HANGUL_SYLLABLE_PATTERN, '')
}

/**
 * 공대 행에서 읽은 직업명이 후보 직업명과 같은지 판단하는 제안 규칙이다. 정규화한 두 문자열이 같으면
 * `exact`다. 긴 이름은 돋보기 앞에서 글자 중간이 잘리므로, 읽은 문자열이 4자 이상이고 후보 이름이 그
 * 문자열로 시작하거나 마지막 한 글자를 뺀 문자열로 시작하면 `clipped-prefix`다. 잘린 마지막 글자를 다른
 * 한글로 읽는 경우를 위해 한 글자를 허용한다.
 */
export function matchJobName(observed: string, candidate: string): JobNameMatch | null {
  const read = normalizeJobName(observed)
  const expected = normalizeJobName(candidate)
  if (read === '' || expected === '') {
    return null
  }

  if (read === expected) {
    return 'exact'
  }
  const characters = [...read]
  if (characters.length < CLIPPED_MIN_LENGTH || [...expected].length < characters.length) {
    return null
  }
  const withoutLast = characters.slice(0, -1).join('')
  if (
    expected.startsWith(read) ||
    (characters.length > CLIPPED_MIN_LENGTH && expected.startsWith(withoutLast))
  ) {
    return 'clipped-prefix'
  }

  return null
}

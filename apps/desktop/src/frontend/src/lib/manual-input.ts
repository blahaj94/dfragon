/** 수동 입력이 유효한 유니코드 문자열이고, 앞뒤 공백 없이 2~12개 코드 포인트로 이루어졌는지 확인한다. */
export function validManualNickname(nickname: string): boolean {
  // Match the API limit in Unicode code points, not UTF-16 units or grapheme clusters.
  const length = [...nickname].length
  return length >= 2 && length <= 12 && nickname === nickname.trim() && nickname.isWellFormed()
}

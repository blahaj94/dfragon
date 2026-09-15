export function validManualNickname(nickname: string): boolean {
  // Match the API limit in Unicode code points, not UTF-16 units or grapheme clusters.
  const length = [...nickname].length
  return length >= 2 && length <= 12 && nickname === nickname.trim() && nickname.isWellFormed()
}

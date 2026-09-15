export function validManualNickname(nickname: string): boolean {
  const length = [...nickname].length
  return length >= 2 && length <= 12 && nickname === nickname.trim() && nickname.isWellFormed()
}

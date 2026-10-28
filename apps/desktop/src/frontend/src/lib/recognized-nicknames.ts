type NicknameResult =
  | { kind: 'recognized'; nickname: string }
  | { kind: 'rejected' | 'missing' | 'failed' }

export function getRecognizedNicknames(
  results: readonly NicknameResult[],
  slotCount: number
): (string | null)[] {
  return Array.from({ length: slotCount }, (_, slot) => {
    const result = results[slot]
    if (result?.kind === 'recognized') {
      return result.nickname
    }

    return null
  })
}

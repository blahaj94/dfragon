export const DNF_SEARCH_NICKNAME_LIMITS = {
  minimumCodePoints: 2,
  maximumCodePoints: 12
} as const

/** Search length/padding policy only; callers retain their Unicode decoding and well-formedness guards. */
export function matchesDNFSearchNicknamePolicy(nickname: string): boolean {
  const length = [...nickname].length

  return (
    length >= DNF_SEARCH_NICKNAME_LIMITS.minimumCodePoints &&
    length <= DNF_SEARCH_NICKNAME_LIMITS.maximumCodePoints &&
    nickname === nickname.trim()
  )
}

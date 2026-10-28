import type { CharacterCandidate } from '../../preload/common/types/character'

export function orderedCandidates(candidates: readonly CharacterCandidate[]): CharacterCandidate[] {
  return candidates.toSorted((left, right) => {
    if (left.fame === right.fame) {
      return 0
    }

    if (left.fame === null) {
      return 1
    }

    if (right.fame === null) {
      return -1
    }

    return right.fame - left.fame
  })
}

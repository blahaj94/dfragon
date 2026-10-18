import type { CharacterCandidate } from '../../preload/common/types/character'

/** 명성이 같은 후보는 API 순서를 유지하고 null은 0을 포함한 모든 명성 뒤에 둔다. */
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

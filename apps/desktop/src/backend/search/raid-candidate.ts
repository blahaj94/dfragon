import type { CharacterSelectionMethod } from '@dfragon/desktop-contracts/types/search'
import type { CharacterCandidate } from '@dfragon/desktop-contracts/types/character'
import { orderedCandidates } from './candidate-order'

/**
 * 공대 상세 창의 그 행에서 읽은 값. 공대 창은 서버와 얼굴 대신 명성이나 장비 점수를 보여 주며, 이 값으로
 * 후보를 좁히는 근사 매칭을 붙일 자리다. 아직 공대 창의 값을 읽지 않으므로 지금은 모두 null이다.
 */
export type RaidObservedValues = Readonly<{
  fame: number | null
  /** 화면에 보이는 그대로의 장비 점수 표기(`1000.4K` 등). 숫자로 환산하지 않는다. */
  equipmentScoreText: string | null
}>

/** 공대 창에서 아직 아무 값도 읽지 않은 행 */
export const NO_RAID_OBSERVED_VALUES: RaidObservedValues = { fame: null, equipmentScoreText: null }

export type RaidCandidateSelection = Readonly<{
  candidate: CharacterCandidate
  selectionMethod: CharacterSelectionMethod
}>

/**
 * 공대 자리 하나의 이름 후보 중 표시할 캐릭터를 고른다. 공대 후보 선택은 이 함수 하나가 정하며, 공대 창의
 * 명성이나 장비 점수로 근사 매칭을 하게 되면 이 함수만 바꾼다. 지금은 관측값과 무관하게 최고 명성 후보를
 * 고른다. 명성이 같으면 API 순서를 따르고 명성이 없는 후보는 맨 뒤다. 후보가 없으면 null이다.
 */
export function selectRaidCandidate({
  candidates
}: {
  /** OCR로 읽은 공대원 이름. 후보는 이 이름으로 찾은 결과다. */
  name: string
  observed: RaidObservedValues
  candidates: readonly CharacterCandidate[]
}): RaidCandidateSelection | null {
  const highest = orderedCandidates(candidates)[0]
  if (highest === undefined) {
    return null
  }

  return { candidate: highest, selectionMethod: 'highest-fame' }
}

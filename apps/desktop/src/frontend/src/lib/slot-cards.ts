import type { SearchSlot } from '../../../preload/common/types/search'
import type { CardCharacter, SlotState } from '../types/cards'
import type { SnapshotMark } from './adventure-snapshot'
import { searchSlotNotice, toCharacterCard } from './character-card'

/** 실패와 결과 0건 카드의 안내에 덧붙이는 다음 조회 방법. 파티와 공대가 같다. */
const NEXT_LOOKUP_STEP = 'Alt+R로 다시 인식하거나 서버와 이름을 직접 조회해 주세요.'

/** 검색 슬롯 하나가 카드에 그리는 값. 값 이름은 `CharacterCard`, `RaidCard`의 props를 따른다. */
export type SlotCard = {
  state: SlotState
  /** 찾은 캐릭터. 조회하지 않았거나 찾지 못한 슬롯은 undefined다. */
  character?: CardCharacter
  /** 캡처가 인식한 이름. 캐릭터를 찾기 전까지 카드 이름 칸에 보인다. */
  nickname?: string
  notice?: string
  /** 캡처가 인식하는 동안 진행 표시를 보일 슬롯 */
  loading?: boolean
  /** 모험단 순번 스냅샷과 비교한 표시. 표시가 없는 자리는 undefined다. */
  snapshotMark?: SnapshotMark
  /** 합성 미리보기만 채운다. 제품 카드는 재시도 버튼을 두지 않는다. */
  retryEnabled?: boolean
  retryPending?: boolean
}

/** 검색 슬롯 순서로 슬롯마다 카드 값을 만든다. 슬롯별 입력은 모두 검색 슬롯 순서다. */
export function toSlotCards({
  slots,
  nicknames,
  manualSlots,
  recognizing,
  snapshotMarks
}: {
  slots: readonly SearchSlot[]
  /** 캡처가 인식한 슬롯별 이름. 인식하지 못한 슬롯은 null이다. */
  nicknames: readonly (string | null)[]
  /** 사용자가 직접 조회해 캡처 인식을 기다리지 않는 슬롯 */
  manualSlots: readonly boolean[]
  recognizing: boolean
  snapshotMarks: readonly (SnapshotMark | undefined)[]
}): SlotCard[] {
  return slots.map((slot, index) => {
    const character = toCharacterCard(slot.selected) ?? undefined
    const nickname = nicknames[index] ?? undefined
    const notice = searchSlotNotice(slot, NEXT_LOOKUP_STEP)
    const loading = !manualSlots[index] && recognizing

    return {
      state: slot.state,
      character,
      nickname,
      notice,
      loading,
      snapshotMark: snapshotMarks[index]
    }
  })
}

/** 캐릭터를 찾은 슬롯 수 */
export function filledSlotCount(cards: readonly SlotCard[]): number {
  return cards.filter((card) => card.state === 'success' && card.character != null).length
}

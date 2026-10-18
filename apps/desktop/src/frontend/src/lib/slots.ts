import {
  SEARCH_SLOT_COUNTS,
  type SearchSlot,
  type SearchSlotCount
} from '../../../preload/common/types/search'

/** 검색 결과와 오류가 없는 idle 상태의 슬롯을 수명의 슬롯 수만큼 매번 새 객체로 생성한다. */
export function emptySearchSlots(
  slotCount: SearchSlotCount = SEARCH_SLOT_COUNTS.party
): SearchSlot[] {
  return Array.from({ length: slotCount }, (_, slot) => ({
    slot,
    observationRevision: 0,
    requestId: null,
    nickname: null,
    state: 'idle',
    rows: [],
    error: null
  }))
}

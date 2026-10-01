import type { SearchSlot } from '../../../preload/common/types/search'

/** 검색 결과와 오류가 없는 idle 상태의 슬롯 네 개를 매번 새 객체로 생성한다. */
export function emptySearchSlots(): SearchSlot[] {
  return Array.from({ length: 4 }, (_, slot) => ({
    slot,
    observationRevision: 0,
    requestId: null,
    nickname: null,
    state: 'idle',
    rows: [],
    error: null
  }))
}

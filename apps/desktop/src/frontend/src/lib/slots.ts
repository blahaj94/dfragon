import {
  SEARCH_SLOT_COUNTS,
  type SearchSlot,
  type SearchSlotCount
} from '../../../preload/common/types/search'

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

import type { SearchSlot } from '../../../../preload/common/types/search'

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

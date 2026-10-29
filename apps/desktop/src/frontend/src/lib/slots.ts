import type { SearchSlot, SearchSlotCount } from '../../../preload/common/types/search'

export function fillSlots<T>(slotCount: SearchSlotCount, value: T): T[] {
  return Array.from({ length: slotCount }, () => value)
}

export function emptySearchSlots(slotCount: SearchSlotCount): SearchSlot[] {
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

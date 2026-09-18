import type { SearchSlot } from '../../../preload/common/types/search'

export type SearchView = {
  captureActive?: boolean
  ready: boolean
  slots: readonly SearchSlot[]
  retryPending: readonly boolean[]
  connectionFailed: boolean
}

export type SlotEditing = {
  manualSlots: readonly boolean[]
  editSlot: (slot: number) => void
  submitSlot: (slot: number, nickname: string) => void
  resumeOcr: (slot: number) => void
}

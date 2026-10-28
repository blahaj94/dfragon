import type { SearchSlot } from '../../../preload/common/types/search'

export type SearchView = {
  ready: boolean
  slots: readonly SearchSlot[]
  retryPending: readonly boolean[]
  connectionFailed: boolean
}

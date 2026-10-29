import type { SearchSlot } from '../../../preload/common/types/search'

export type SearchView = {
  ready: boolean
  slots: readonly SearchSlot[]
  connectionFailed: boolean
}

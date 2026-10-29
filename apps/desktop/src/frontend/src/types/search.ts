import type { SearchSlot } from '../../../preload/common/types/search'

export type SearchView = {
  ready: boolean
  slots: readonly SearchSlot[]
  /** 마지막 회차 시작이나 종료 뒤 사용자가 서버와 이름으로 조회한 슬롯. 회차의 OCR 결과가 덮지 않는다. */
  manualSlots: readonly boolean[]
  connectionFailed: boolean
}

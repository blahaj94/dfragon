import { SEARCH_ERRORS, type SearchSlot } from '../../../preload/common/types/search'

// 검색 슬롯의 결과·오류·대기 상태를 표시 문구로 변환한다.
export function getSearchResultStatus(slot: SearchSlot): string {
  if (slot.state === 'success') {
    return `검색 결과 ${slot.rows.length}명`
  }
  if (slot.state === 'failure' && slot.error != null) {
    return SEARCH_ERRORS[slot.error.code].message
  }
  if (slot.state === 'pending') {
    return '검색 중'
  }
  if (slot.state === 'empty') {
    return '검색 결과가 없습니다.'
  }
  return '인식 대기'
}

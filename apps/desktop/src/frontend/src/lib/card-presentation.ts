import type { SlotState } from '../types/cards'

// 캐릭터 카드의 검색 상태에 맞는 표시 문구를 반환한다.
export function getCharacterCardStatus(state: SlotState): string {
  if (state === 'failure') {
    return '검색 실패'
  }
  if (state === 'empty') {
    return '검색 결과가 없습니다'
  }
  if (state === 'pending') {
    return '검색 중…'
  }
  return ''
}

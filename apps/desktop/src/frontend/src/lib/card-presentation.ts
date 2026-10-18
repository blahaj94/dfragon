import type { CardFrameState } from '@dfragon/ui'
import type { SlotState } from '../types/cards'

// 캐릭터 카드의 검색 상태에 맞는 표시 문구를 반환한다.
export function getCharacterCardStatus(state: SlotState): string {
  if (state === 'waiting-portrait') {
    return '얼굴 인식 대기'
  }

  if (state === 'waiting-policy') {
    return '자동 식별 준비 중'
  }

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

/** 파티 카드가 쓰는 카드 상태. 상위와 랭커 단계는 아직 파티 카드에 연결하지 않았다. */
export type CharacterCardFrameState = Extract<
  CardFrameState,
  'default' | 'selected' | 'failure' | 'waiting'
>

/** 빈 슬롯과 인식 대기. 상세 열기와 면 탭이 없는 비어 있는 카드다. */
export function isVacantSlot(state: SlotState): boolean {
  return state === 'idle' || state === 'waiting-portrait' || state === 'waiting-policy'
}

/**
 * 검색 상태와 이름 수정 여부로 카드의 꺾쇠 상태를 정한다(dfragon-design colors.md의 카드 상태와 꺾쇠).
 * 이름을 고치는 중이면 다른 상태보다 앞서 선택으로 보인다. 결과 0건은 조회 실패와 같은 모양이고
 * 문구로 구분한다. 빈 슬롯과 인식 대기는 꺾쇠 없는 대기 카드다.
 */
export function getCharacterCardFrameState({
  state,
  editing
}: {
  state: SlotState
  editing: boolean
}): CharacterCardFrameState {
  if (editing) {
    return 'selected'
  }

  if (state === 'failure' || state === 'empty') {
    return 'failure'
  }

  if (isVacantSlot(state)) {
    return 'waiting'
  }

  return 'default'
}

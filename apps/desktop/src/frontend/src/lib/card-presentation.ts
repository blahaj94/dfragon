import type { CardFrameState } from '@dfragon/ui'
import type { CharacterTier, SlotState } from '../types/cards'
import type { SlotCard } from './slot-cards'

export const LOOKUP_STEPS = ['이름 인식', '캐릭터 검색', '상세 정보 확인'] as const
export type LookupStep = (typeof LOOKUP_STEPS)[number]

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

export type CharacterCardFrameState = Extract<
  CardFrameState,
  'default' | 'selected' | 'failure' | 'waiting' | CharacterTier
>

export function isVacantSlot(state: SlotState): boolean {
  return state === 'idle'
}

/** 직접 조회는 사용자가 이름을 넣은 뒤라 캐릭터 검색 단계부터 보인다. */
export function getLookupStep({
  state,
  loading = false,
  scorePending = false
}: Pick<SlotCard, 'state' | 'loading' | 'scorePending'>): LookupStep | null {
  if (loading) {
    return '이름 인식'
  }

  if (state === 'pending') {
    return '캐릭터 검색'
  }

  if (state === 'success' && scorePending) {
    return '상세 정보 확인'
  }

  return null
}

export function getCharacterCardFrameState({
  state,
  editing,
  tier
}: {
  state: SlotState
  editing: boolean
  tier?: CharacterTier
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

  if (state === 'success' && tier !== undefined) {
    return tier
  }

  return 'default'
}

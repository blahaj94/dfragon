import type { CardFrameState } from '@dfragon/ui'
import type { CharacterTier, SlotState } from '../types/cards'

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

export type CharacterCardFrameState = Extract<
  CardFrameState,
  'default' | 'selected' | 'failure' | 'waiting' | CharacterTier
>

export function isVacantSlot(state: SlotState): boolean {
  return state === 'idle' || state === 'waiting-portrait' || state === 'waiting-policy'
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

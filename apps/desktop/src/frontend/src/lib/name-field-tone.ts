import type { SlotState } from '../types/cards'
import type { CharacterCardFrameState } from './card-presentation'

export type NameFieldTone = 'default' | 'selected' | 'waiting' | 'failure' | 'vacant'

export function toNameFieldTone(
  frameState: CharacterCardFrameState,
  state: SlotState
): NameFieldTone {
  if (frameState === 'selected' || frameState === 'failure') {
    return frameState
  }

  if (frameState !== 'waiting') {
    return 'default'
  }

  if (state === 'idle') {
    return 'vacant'
  }

  return 'waiting'
}

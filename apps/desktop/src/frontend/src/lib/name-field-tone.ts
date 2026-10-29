import type { CharacterCardFrameState } from './card-presentation'

export type NameFieldTone = 'default' | 'selected' | 'failure' | 'vacant'

export function toNameFieldTone(frameState: CharacterCardFrameState): NameFieldTone {
  if (frameState === 'selected' || frameState === 'failure') {
    return frameState
  }

  if (frameState === 'waiting') {
    return 'vacant'
  }

  return 'default'
}

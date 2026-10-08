import type { SearchObservation } from './search'
import type { CharacterImage } from './character'

export type CaptureSource = {
  id: string
  name: string
}

export type StableNicknameDetection = SearchObservation

export type WindowFrameResult =
  | { kind: 'frame'; image: CharacterImage; frameId?: string }
  | { kind: 'waiting'; reason: 'covered' | 'unavailable' }
  | { kind: 'unsupported' }

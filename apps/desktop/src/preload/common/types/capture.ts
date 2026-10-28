import type { RaidValueColumn } from './search'
import type { CharacterImage } from './character'

export type CaptureSource = {
  id: string
  name: string
}

export type WindowFrameResult =
  | { kind: 'frame'; image: CharacterImage }
  | { kind: 'waiting'; reason: 'covered' | 'unavailable' }
  | { kind: 'unsupported' }

export type RaidFrameRow = Readonly<{
  nickname: CharacterImage
  job: CharacterImage | null
  valueText: string | null
}>

export type RaidFrameResult =
  | { kind: 'rows'; valueColumn: RaidValueColumn; rows: readonly (RaidFrameRow | null)[] }
  | { kind: 'missing'; reason: 'not-found' | 'uncertain' }
  | Exclude<WindowFrameResult, { kind: 'frame' }>

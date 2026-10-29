import type { CharacterScoreCalculator } from '../../preload/common/types/character'
import type { ScoreEngineInput } from './input'

export type ScoreWorkerData = Readonly<{ path: string }>
export type ScoreWorkerRequest = Readonly<{
  id: number
  input: ScoreEngineInput
  calculator: CharacterScoreCalculator
}>
export type ScoreWorkerMessage =
  | Readonly<{ kind: 'unavailable' }>
  | Readonly<{ kind: 'result'; id: number; text: string | null; elapsedMs: number }>

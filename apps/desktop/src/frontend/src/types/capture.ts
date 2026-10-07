import type { CtcCandidate } from '../lib/ctc-candidates'

export type Rgb = readonly [red: number, green: number, blue: number]

export type SlotStability = {
  candidate: string | null
  consecutiveCount: number
  stableNickname: string | null
}

export type PartyOcrResult = {
  text: string
  /** 응답 호환용 confidence 필드는 1위 후보의 modelScore를 전달한다. */
  confidence: number
  candidates: CtcCandidate[]
}

export type PartyOcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: PartyOcrResult }>
  terminate: () => Promise<void>
}

export type CapturePhase = 'idle' | 'selecting' | 'selected' | 'starting' | 'active' | 'failed'

import type { CtcCandidate } from '../lib/ctc-candidates'

export type Rgb = readonly [red: number, green: number, blue: number]

export type PartyOcrResult = {
  text: string
  confidence: number
  candidates: CtcCandidate[]
}

export type PartyOcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: PartyOcrResult }>
  terminate: () => Promise<void>
}

export type CapturePhase =
  | 'idle'
  | 'selecting'
  | 'selected'
  | 'recognizing'
  | 'complete'
  | 'unavailable'
  | 'failed'

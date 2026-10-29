import type { CtcCandidate } from '../lib/ctc-candidates'

export type PartyOcrResult = {
  candidates: CtcCandidate[]
}

export type PartyOcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<PartyOcrResult>
  terminate: () => void
}

export type CapturePhase =
  | 'idle'
  | 'selecting'
  | 'selected'
  | 'recognizing'
  | 'complete'
  | 'unavailable'
  | 'failed'

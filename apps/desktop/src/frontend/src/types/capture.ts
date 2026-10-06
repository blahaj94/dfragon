export type Rgb = readonly [red: number, green: number, blue: number]

export type SlotStability = {
  candidate: string | null
  consecutiveCount: number
  stableNickname: string | null
}

export type PartyOcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string; confidence: number } }>
  terminate: () => Promise<void>
}

export type CapturePhase = 'idle' | 'selecting' | 'selected' | 'starting' | 'active' | 'failed'

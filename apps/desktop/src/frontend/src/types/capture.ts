export type Rectangle = {
  x: number
  y: number
  width: number
  height: number
}

export type PartySlot = {
  nickname: Rectangle
  mana: Rectangle
}

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

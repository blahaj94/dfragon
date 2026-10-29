export type DNFRectangle = { x: number; y: number; width: number; height: number }

export type DNFParticipantFrame = Readonly<{
  width: number
  height: number
  rgba: Uint8Array | Uint8ClampedArray
}>

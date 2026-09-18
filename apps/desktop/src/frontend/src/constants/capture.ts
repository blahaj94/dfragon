import type { PartySlot } from '../types/capture'

export const PARTY_MANA_COLOR = [55, 121, 170] as const

// 1920×1080 borderless-window layout, calibrated against game UI scale 50%.
export const PARTY_SLOTS: readonly PartySlot[] = [
  {
    nickname: { x: 56, y: 15, width: 91, height: 14 },
    mana: { x: 42, y: 42, width: 105, height: 5 }
  },
  {
    nickname: { x: 206, y: 15, width: 91, height: 14 },
    mana: { x: 192, y: 42, width: 105, height: 5 }
  },
  {
    nickname: { x: 356, y: 15, width: 91, height: 14 },
    mana: { x: 342, y: 42, width: 105, height: 5 }
  },
  {
    nickname: { x: 506, y: 15, width: 91, height: 14 },
    mana: { x: 492, y: 42, width: 105, height: 5 }
  }
]

export const MANA_COLOR_TOLERANCE = 35
export const MINIMUM_MANA_PIXELS = 50

export const SUPPORTED_WIDTH = 1920
export const SUPPORTED_HEIGHT = 1080
export const REQUEST_TIMEOUT_MS = 30_000

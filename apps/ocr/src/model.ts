import type { OCR_UPLOAD } from './constants.js'

export const splits = ['unassigned', 'train', 'val', 'test'] as const
export type Split = (typeof splits)[number]
export type Crop = { slot: number; x: number; y: number; width: number; height: number }
export type Capture = {
  id: string
  capturedAt: string
  kind: keyof typeof OCR_UPLOAD.maximumCropsByKind
  width: number
  height: number
  uiScale: number | null
  uiScaleSource: 'game' | 'estimated' | 'unknown'
  crops: Crop[]
}
export type Sample = Crop & {
  id: string
  captureId: string
  capturedAt: string
  kind: Capture['kind']
  frameWidth: number
  frameHeight: number
  uiScale: number | null
  uiScaleSource: Capture['uiScaleSource']
  text: string | null
  excluded: boolean
  split: Split
}

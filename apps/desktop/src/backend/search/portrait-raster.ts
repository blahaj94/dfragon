import { setImmediate } from 'node:timers/promises'
import type { CharacterImage, CharacterPortrait } from '../../preload/common/types/character'

export const RGBA_CHANNELS = 4
export const ALPHA_CHANNEL = 3
const PIXEL_CENTER = 0.5

export const PORTRAIT_COMPARISON_LIMITS = {
  imageDimension: 2048,
  imagePixels: 1024 * 1024,
  normalizedDimension: 256,
  comparisonSteps: 32 * 1024 * 1024,
  workPerYield: 16 * 1024
} as const

export type OpaqueBounds = Readonly<{ left: number; top: number; right: number; bottom: number }>
export type SearchBudget = { comparisonSteps: number; workSinceYield: number }
export type PortraitRaster = Readonly<{
  width: number
  height: number
  rgba: Uint8Array
  valid: Uint8Array
}>

export class PortraitComparisonBudgetExceededError extends Error {
  constructor() {
    super('Portrait comparison exceeded its comparison step budget')
    this.name = 'PortraitComparisonBudgetExceededError'
  }
}

export function validateImage(image: CharacterImage): void {
  if (
    image == null ||
    !Number.isSafeInteger(image.width) ||
    !Number.isSafeInteger(image.height) ||
    image.width < 1 ||
    image.height < 1 ||
    image.width > PORTRAIT_COMPARISON_LIMITS.imageDimension ||
    image.height > PORTRAIT_COMPARISON_LIMITS.imageDimension ||
    image.width * image.height > PORTRAIT_COMPARISON_LIMITS.imagePixels ||
    !(image.rgba instanceof Uint8Array) ||
    image.rgba.length !== image.width * image.height * RGBA_CHANNELS
  ) {
    throw new TypeError('Invalid character portrait image')
  }
}

export function createSearchBudget(): SearchBudget {
  return { comparisonSteps: 0, workSinceYield: 0 }
}

export function countComparisonStep(budget: SearchBudget): void {
  budget.comparisonSteps += 1
  if (budget.comparisonSteps > PORTRAIT_COMPARISON_LIMITS.comparisonSteps) {
    throw new PortraitComparisonBudgetExceededError()
  }
}

export function shouldYield(budget: SearchBudget): boolean {
  budget.workSinceYield += 1

  return budget.workSinceYield >= PORTRAIT_COMPARISON_LIMITS.workPerYield
}

export async function yieldSearch(budget: SearchBudget, signal: AbortSignal): Promise<void> {
  await setImmediate()
  signal.throwIfAborted()
  budget.workSinceYield = 0
}

export async function rasterizePortrait(
  portrait: CharacterPortrait,
  budget: SearchBudget,
  signal: AbortSignal
): Promise<PortraitRaster> {
  if (portrait == null || !Number.isFinite(portrait.rasterScale) || portrait.rasterScale <= 0) {
    throw new TypeError('Invalid portrait raster scale')
  }
  validateImage(portrait.image)
  const { image, rasterScale, validMask } = portrait
  const width = Math.round(image.width / rasterScale)
  const height = Math.round(image.height / rasterScale)
  if (
    width < 1 ||
    height < 1 ||
    width > PORTRAIT_COMPARISON_LIMITS.normalizedDimension ||
    height > PORTRAIT_COMPARISON_LIMITS.normalizedDimension
  ) {
    throw new RangeError('Normalized portrait dimensions exceed the supported range')
  }

  if (validMask !== undefined) {
    if (!(validMask instanceof Uint8Array) || validMask.length !== image.width * image.height) {
      throw new TypeError('Invalid portrait mask dimensions')
    }
    for (const value of validMask) {
      if (value !== 0 && value !== 1) {
        throw new TypeError('Portrait mask values must be zero or one')
      }

      if (shouldYield(budget)) {
        await yieldSearch(budget, signal)
      }
    }
  }

  const rgba = new Uint8Array(width * height * RGBA_CHANNELS)
  const valid = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor((y + PIXEL_CENTER) * rasterScale))
    for (let x = 0; x < width; x += 1) {
      if (shouldYield(budget)) {
        await yieldSearch(budget, signal)
      }
      const sourceX = Math.min(image.width - 1, Math.floor((x + PIXEL_CENTER) * rasterScale))
      const sourcePixel = sourceY * image.width + sourceX
      const sourceOffset = sourcePixel * RGBA_CHANNELS
      const pixel = y * width + x
      rgba.set(
        image.rgba.subarray(sourceOffset, sourceOffset + RGBA_CHANNELS),
        pixel * RGBA_CHANNELS
      )
      if (image.rgba[sourceOffset + ALPHA_CHANNEL] !== 0 && validMask?.[sourcePixel] !== 0) {
        valid[pixel] = 1
      }
    }
  }

  return { width, height, rgba, valid }
}

export async function findOpaqueBounds(
  candidate: CharacterImage,
  budget: SearchBudget,
  signal: AbortSignal
): Promise<OpaqueBounds | null> {
  let left = candidate.width
  let top = candidate.height
  let right = -1
  let bottom = -1
  for (let y = 0; y < candidate.height; y += 1) {
    for (let x = 0; x < candidate.width; x += 1) {
      if (shouldYield(budget)) {
        await yieldSearch(budget, signal)
      }
      const offset = (y * candidate.width + x) * RGBA_CHANNELS
      if (candidate.rgba[offset + ALPHA_CHANNEL] !== 0) {
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
      }
    }
  }

  if (right < left) {
    return null
  }

  return { left, top, right, bottom }
}

import { setImmediate } from 'node:timers/promises'
import type { CharacterImage, CharacterPortrait } from '../../preload/common/types/character'

export const RGBA_CHANNELS = 4
export const ALPHA_CHANNEL = 3
const PIXEL_CENTER = 0.5

/** 계산량 한도이며 캐릭터 일치 여부를 결정하는 허용 오차가 아니다. */
export const PORTRAIT_MATCH_LIMITS = {
  imageDimension: 2048,
  imagePixels: 1024 * 1024,
  normalizedDimension: 256,
  evaluatedPixels: 32 * 1024 * 1024,
  workPerYield: 16 * 1024
} as const

export type OpaqueBounds = Readonly<{ left: number; top: number; right: number; bottom: number }>
/** 한 번의 비교가 소유하는 계산량과 양보 시점. 비교마다 새로 만든다. */
export type SearchBudget = { evaluatedPixels: number; workSinceYield: number }
/** UI 배율을 되돌린 얼굴. valid는 픽셀당 0 또는 1이며 투명하거나 마스크로 제외한 픽셀은 0이다. */
export type PortraitRaster = Readonly<{
  width: number
  height: number
  rgba: Uint8Array
  valid: Uint8Array
}>

export class PortraitMatchBudgetExceededError extends Error {
  constructor() {
    super('Portrait comparison exceeded its pixel evaluation budget')
    this.name = 'PortraitMatchBudgetExceededError'
  }
}

export function validateImage(image: CharacterImage): void {
  if (
    image == null ||
    !Number.isSafeInteger(image.width) ||
    !Number.isSafeInteger(image.height) ||
    image.width < 1 ||
    image.height < 1 ||
    image.width > PORTRAIT_MATCH_LIMITS.imageDimension ||
    image.height > PORTRAIT_MATCH_LIMITS.imageDimension ||
    image.width * image.height > PORTRAIT_MATCH_LIMITS.imagePixels ||
    !(image.rgba instanceof Uint8Array) ||
    image.rgba.length !== image.width * image.height * RGBA_CHANNELS
  ) {
    throw new TypeError('Invalid character portrait image')
  }
}

export function createSearchBudget(): SearchBudget {
  return { evaluatedPixels: 0, workSinceYield: 0 }
}

/** comparing은 예산을 소모하는 비교 단위이며 예산을 넘으면 실패를 숨기지 않고 던진다. */
export function shouldYield(budget: SearchBudget, comparing = false): boolean {
  if (comparing) {
    budget.evaluatedPixels += 1
    if (budget.evaluatedPixels > PORTRAIT_MATCH_LIMITS.evaluatedPixels) {
      throw new PortraitMatchBudgetExceededError()
    }
  }
  budget.workSinceYield += 1

  return budget.workSinceYield >= PORTRAIT_MATCH_LIMITS.workPerYield
}

export async function yieldSearch(budget: SearchBudget, signal: AbortSignal): Promise<void> {
  await setImmediate()
  signal.throwIfAborted()
  budget.workSinceYield = 0
}

/** 크롭한 얼굴을 rasterScale 1 크기로 되돌린다. 원본 이미지와 마스크 버퍼는 읽기만 한다. */
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
    width > PORTRAIT_MATCH_LIMITS.normalizedDimension ||
    height > PORTRAIT_MATCH_LIMITS.normalizedDimension
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
  // 최근접 샘플링으로 원본 픽셀을 보존한다. 좌표와 UI 배율 추정은 크롭 제공자의 책임이다.
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

import { setImmediate } from 'node:timers/promises'
import type { CharacterImage, CharacterPortrait } from '../../preload/common/types/character'

const RGBA_CHANNELS = 4
const RGB_CHANNELS = 3
const ALPHA_CHANNEL = 3
const MAX_CHANNEL_VALUE = 255
const PIXEL_CENTER = 0.5

/** 계산량 한도이며 캐릭터 일치 여부를 결정하는 허용 오차가 아니다. */
export const PORTRAIT_MATCH_LIMITS = {
  imageDimension: 2048,
  imagePixels: 1024 * 1024,
  normalizedDimension: 256,
  evaluatedPixels: 32 * 1024 * 1024,
  workPerYield: 16 * 1024
} as const

export type PortraitScore = Readonly<{
  meanChannelError: number
  comparedPixels: number
  /** 정규화된 얼굴의 유효 픽셀 중 후보의 불투명 픽셀과 겹친 비율. */
  coverage: number
  /** zoom=1 후보 이미지에서 정규화된 얼굴 좌상단의 정수 좌표와 크기. */
  alignment: Readonly<{ x: number; y: number; width: number; height: number }>
}>

export type PortraitMatchPolicy = Readonly<{
  maxMeanChannelError: number
  minCoverage: number
  minComparedPixels: number
}>

type PortraitMatchInput = Readonly<{
  portrait: CharacterPortrait
  candidate: CharacterImage
  signal: AbortSignal
}>
type Sample = Readonly<{ x: number; y: number; red: number; green: number; blue: number }>
type NormalizedPortrait = Readonly<{ width: number; height: number; samples: readonly Sample[] }>
type OpaqueBounds = Readonly<{ left: number; top: number; right: number; bottom: number }>
type SearchBudget = { evaluatedPixels: number; workSinceYield: number }

export class PortraitMatchBudgetExceededError extends Error {
  constructor() {
    super('Portrait comparison exceeded its pixel evaluation budget')
    this.name = 'PortraitMatchBudgetExceededError'
  }
}

function validateImage(image: CharacterImage): void {
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

function shouldYield(budget: SearchBudget, comparing = false): boolean {
  if (comparing) {
    budget.evaluatedPixels += 1
    if (budget.evaluatedPixels > PORTRAIT_MATCH_LIMITS.evaluatedPixels) {
      throw new PortraitMatchBudgetExceededError()
    }
  }
  budget.workSinceYield += 1

  return budget.workSinceYield >= PORTRAIT_MATCH_LIMITS.workPerYield
}

async function yieldSearch(budget: SearchBudget, signal: AbortSignal): Promise<void> {
  await setImmediate()
  signal.throwIfAborted()
  budget.workSinceYield = 0
}

async function normalizePortrait(
  portrait: CharacterPortrait,
  budget: SearchBudget,
  signal: AbortSignal
): Promise<NormalizedPortrait | null> {
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

  const samples: Sample[] = []
  let informative = false
  // 최근접 샘플링으로 원본 픽셀을 보존한다. 좌표와 UI 배율 추정은 크롭 제공자의 책임이다.
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor((y + PIXEL_CENTER) * rasterScale))
    for (let x = 0; x < width; x += 1) {
      if (shouldYield(budget)) {
        await yieldSearch(budget, signal)
      }
      const sourceX = Math.min(image.width - 1, Math.floor((x + PIXEL_CENTER) * rasterScale))
      const pixel = sourceY * image.width + sourceX
      const offset = pixel * RGBA_CHANNELS
      if (image.rgba[offset + ALPHA_CHANNEL] === 0 || validMask?.[pixel] === 0) {
        continue
      }
      const red = image.rgba[offset]
      const green = image.rgba[offset + 1]
      const blue = image.rgba[offset + 2]
      const first = samples[0]
      if (first && (red !== first.red || green !== first.green || blue !== first.blue)) {
        informative = true
      }
      samples.push({ x, y, red, green, blue })
    }
  }

  if (!informative) {
    return null
  }

  return { width, height, samples }
}

async function findOpaqueBounds(
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

async function findPortraitAlignment(
  { portrait, candidate, signal }: PortraitMatchInput,
  policy?: PortraitMatchPolicy
): Promise<PortraitScore | null> {
  signal.throwIfAborted()
  validateImage(candidate)
  const budget: SearchBudget = { evaluatedPixels: 0, workSinceYield: 0 }
  const normalized = await normalizePortrait(portrait, budget, signal)
  signal.throwIfAborted()
  if (normalized == null) {
    return null
  }
  const bounds = await findOpaqueBounds(candidate, budget, signal)
  signal.throwIfAborted()
  if (bounds == null) {
    return null
  }
  const { width, height, samples } = normalized
  const lastX = Math.min(bounds.right, candidate.width - width)
  const lastY = Math.min(bounds.bottom, candidate.height - height)
  const firstX = Math.max(0, bounds.left - width + 1)
  const firstY = Math.max(0, bounds.top - height + 1)
  let best: PortraitScore | null = null
  let bestRankError = Infinity
  for (let y = firstY; y <= lastY; y += 1) {
    for (let x = firstX; x <= lastX; x += 1) {
      let channelError = 0
      let comparedPixels = 0
      for (const sample of samples) {
        if (shouldYield(budget, true)) {
          await yieldSearch(budget, signal)
        }
        const offset = ((y + sample.y) * candidate.width + x + sample.x) * RGBA_CHANNELS
        if (candidate.rgba[offset + ALPHA_CHANNEL] === 0) {
          continue
        }
        channelError +=
          Math.abs(sample.red - candidate.rgba[offset]) +
          Math.abs(sample.green - candidate.rgba[offset + 1]) +
          Math.abs(sample.blue - candidate.rgba[offset + 2])
        comparedPixels += 1
      }

      if (comparedPixels === 0) {
        continue
      }
      const meanChannelError = channelError / (comparedPixels * RGB_CHANNELS)
      const coverage = comparedPixels / samples.length
      // 점수상 최적 위치가 허용 기준에서 탈락해도 다른 정렬의 일치를 누락하지 않는다.
      if (
        policy !== undefined &&
        (meanChannelError > policy.maxMeanChannelError ||
          coverage < policy.minCoverage ||
          comparedPixels < policy.minComparedPixels)
      ) {
        continue
      }
      // 투명한 작은 조각의 낮은 평균 오차가 충분한 비교 영역보다 우선하지 않게 한다.
      const missingPixels = samples.length - comparedPixels
      const rankError = channelError + missingPixels * RGB_CHANNELS * MAX_CHANNEL_VALUE
      if (
        rankError < bestRankError ||
        (rankError === bestRankError && best !== null && comparedPixels > best.comparedPixels)
      ) {
        const alignment = { x, y, width, height }
        bestRankError = rankError
        best = { meanChannelError, comparedPixels, coverage, alignment }
      }

      if (policy !== undefined) {
        signal.throwIfAborted()

        return best
      }
    }
  }
  signal.throwIfAborted()

  return best
}

/** 화면 크롭 없이 이미 크롭된 얼굴을 후보 스프라이트 안에서 정렬해 RGB 오차를 구한다. */
export async function scoreCharacterPortrait(
  input: PortraitMatchInput
): Promise<PortraitScore | null> {
  return findPortraitAlignment(input)
}

/** 실제 Windows 표본으로 정한 허용 기준을 주입하며 운영 기본값은 제공하지 않는다. */
export function createPortraitMatcher(
  policy: PortraitMatchPolicy
): (input: PortraitMatchInput) => Promise<boolean> {
  if (
    policy == null ||
    !Number.isFinite(policy.maxMeanChannelError) ||
    policy.maxMeanChannelError < 0 ||
    policy.maxMeanChannelError > MAX_CHANNEL_VALUE ||
    !Number.isFinite(policy.minCoverage) ||
    policy.minCoverage <= 0 ||
    policy.minCoverage > 1 ||
    !Number.isSafeInteger(policy.minComparedPixels) ||
    policy.minComparedPixels < 1 ||
    policy.minComparedPixels >
      PORTRAIT_MATCH_LIMITS.normalizedDimension * PORTRAIT_MATCH_LIMITS.normalizedDimension
  ) {
    throw new TypeError('Invalid portrait match acceptance policy')
  }
  const { maxMeanChannelError, minCoverage, minComparedPixels } = policy
  const acceptance = { maxMeanChannelError, minCoverage, minComparedPixels }

  return async (input) => {
    const score = await findPortraitAlignment(input, acceptance)

    return score !== null
  }
}

import type { CharacterImage, CharacterPortrait } from '../../preload/common/types/character'
import {
  ALPHA_CHANNEL,
  createSearchBudget,
  findOpaqueBounds,
  PORTRAIT_MATCH_LIMITS,
  RGBA_CHANNELS,
  rasterizePortrait,
  type SearchBudget,
  shouldYield,
  validateImage,
  yieldSearch
} from './portrait-raster'

export { PORTRAIT_MATCH_LIMITS, PortraitMatchBudgetExceededError } from './portrait-raster'

const RGB_CHANNELS = 3
const MAX_CHANNEL_VALUE = 255

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

async function normalizePortrait(
  portrait: CharacterPortrait,
  budget: SearchBudget,
  signal: AbortSignal
): Promise<NormalizedPortrait | null> {
  const { width, height, rgba, valid } = await rasterizePortrait(portrait, budget, signal)
  const samples: Sample[] = []
  let informative = false
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x
      if (valid[pixel] === 0) {
        continue
      }
      const offset = pixel * RGBA_CHANNELS
      const red = rgba[offset]
      const green = rgba[offset + 1]
      const blue = rgba[offset + 2]
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

async function findPortraitAlignment(
  { portrait, candidate, signal }: PortraitMatchInput,
  policy?: PortraitMatchPolicy
): Promise<PortraitScore | null> {
  signal.throwIfAborted()
  validateImage(candidate)
  const budget = createSearchBudget()
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

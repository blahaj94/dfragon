import { setImmediate } from 'node:timers/promises'
import type { CharacterImage, CharacterPortrait } from '../../preload/common/types/character'
import { PORTRAIT_MATCH_LIMITS, PortraitMatchBudgetExceededError } from './portrait-match'

const RGBA_CHANNELS = 4
const ALPHA_CHANNEL = 3
const OPAQUE_ALPHA = 255
const PIXEL_CENTER = 0.5
const GRAY_RED_WEIGHT = 0.299
const GRAY_GREEN_WEIGHT = 0.587
const GRAY_BLUE_WEIGHT = 0.114
const NEIGHBORHOOD_RADIUS = 1
const SOBEL_CENTER_WEIGHT = 2
const DOUBLE_ANGLE_FACTOR = 2
const LOCAL_GRADIENT_NOISE_FLOOR = 4
const LOCAL_GRADIENT_WEIGHT_CAP = 2
const MIN_SIMILARITY = -1
const MAX_SIMILARITY = 1

export type PortraitEdgeRequirements = Readonly<{
  minCoverage: number
  minComparedPixels: number
}>

export type PortraitEdgeMatchPolicy = PortraitEdgeRequirements & Readonly<{ minSimilarity: number }>

export type PortraitEdgeScore = Readonly<{
  similarity: number
  comparedPixels: number
  /** 얼굴의 유효한 nonzero 경계 벡터 중 후보의 유효 영역과 겹친 비율. */
  coverage: number
  alignment: Readonly<{ x: number; y: number; width: number; height: number }>
}>

type PortraitEdgeInput = Readonly<{
  portrait: CharacterPortrait
  candidate: CharacterImage
  signal: AbortSignal
}>
type Raster = Readonly<{
  width: number
  height: number
  scale: number
  mask?: Uint8Array
}>
type EdgeDescriptor = Readonly<{
  width: number
  height: number
  hasEnergy: boolean
  valid: Uint8Array
  cosine: Float32Array
  sine: Float32Array
}>
type EdgeSample = Readonly<{
  candidateOffset: number
  cosine: number
  sine: number
  energy: number
}>
type SearchBudget = { evaluatedPixels: number; workSinceYield: number }

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

function validateRequirements(requirements: PortraitEdgeRequirements): void {
  if (
    requirements == null ||
    !Number.isFinite(requirements.minCoverage) ||
    requirements.minCoverage <= 0 ||
    requirements.minCoverage > 1 ||
    !Number.isSafeInteger(requirements.minComparedPixels) ||
    requirements.minComparedPixels < 1 ||
    requirements.minComparedPixels >
      PORTRAIT_MATCH_LIMITS.normalizedDimension * PORTRAIT_MATCH_LIMITS.normalizedDimension
  ) {
    throw new TypeError('Invalid portrait edge comparison requirements')
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

async function portraitRaster(
  portrait: CharacterPortrait,
  budget: SearchBudget,
  signal: AbortSignal
): Promise<Raster> {
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

  return { width, height, scale: rasterScale, mask: validMask }
}

async function describeEdges(
  image: CharacterImage,
  raster: Raster,
  budget: SearchBudget,
  signal: AbortSignal
): Promise<EdgeDescriptor> {
  const { width, height, scale, mask } = raster
  const count = width * height
  const gray = new Float32Array(count)
  const inputValid = new Uint8Array(count)
  const valid = new Uint8Array(count)
  const magnitude = new Float32Array(count)
  const cosine = new Float32Array(count)
  const sine = new Float32Array(count)
  let hasEnergy = false
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor((y + PIXEL_CENTER) * scale))
    for (let x = 0; x < width; x += 1) {
      if (shouldYield(budget)) {
        await yieldSearch(budget, signal)
      }
      const sourceX = Math.min(image.width - 1, Math.floor((x + PIXEL_CENTER) * scale))
      const sourcePixel = sourceY * image.width + sourceX
      const sourceOffset = sourcePixel * RGBA_CHANNELS
      const pixel = y * width + x
      inputValid[pixel] = Number(
        image.rgba[sourceOffset + ALPHA_CHANNEL] === OPAQUE_ALPHA && mask?.[sourcePixel] !== 0
      )
      gray[pixel] =
        GRAY_RED_WEIGHT * image.rgba[sourceOffset] +
        GRAY_GREEN_WEIGHT * image.rgba[sourceOffset + 1] +
        GRAY_BLUE_WEIGHT * image.rgba[sourceOffset + 2]
    }
  }

  for (let y = NEIGHBORHOOD_RADIUS; y < height - NEIGHBORHOOD_RADIUS; y += 1) {
    for (let x = NEIGHBORHOOD_RADIUS; x < width - NEIGHBORHOOD_RADIUS; x += 1) {
      if (shouldYield(budget)) {
        await yieldSearch(budget, signal)
      }
      const pixel = y * width + x
      let neighborhoodValid = true
      // 제외한 픽셀의 색이 가림 경계 자체를 캐릭터 윤곽으로 만들지 않도록 이웃도 검사한다.
      for (let dy = -NEIGHBORHOOD_RADIUS; dy <= NEIGHBORHOOD_RADIUS; dy += 1) {
        for (let dx = -NEIGHBORHOOD_RADIUS; dx <= NEIGHBORHOOD_RADIUS; dx += 1) {
          if (inputValid[pixel + dy * width + dx] === 0) {
            neighborhoodValid = false
          }
        }
      }

      if (!neighborhoodValid) {
        continue
      }
      valid[pixel] = 1
      const gx =
        -gray[pixel - width - 1] +
        gray[pixel - width + 1] -
        SOBEL_CENTER_WEIGHT * gray[pixel - 1] +
        SOBEL_CENTER_WEIGHT * gray[pixel + 1] -
        gray[pixel + width - 1] +
        gray[pixel + width + 1]
      const gy =
        -gray[pixel - width - 1] -
        SOBEL_CENTER_WEIGHT * gray[pixel - width] -
        gray[pixel - width + 1] +
        gray[pixel + width - 1] +
        SOBEL_CENTER_WEIGHT * gray[pixel + width] +
        gray[pixel + width + 1]
      const squared = gx * gx + gy * gy
      if (squared === 0) {
        continue
      }
      magnitude[pixel] = Math.sqrt(squared)
      hasEnergy = true
      // 두 배 각도는 밝기 극성이 반전되어도 같은 경계 방향을 나타낸다.
      cosine[pixel] = (gx * gx - gy * gy) / squared
      sine[pixel] = (DOUBLE_ANGLE_FACTOR * gx * gy) / squared
    }
  }

  for (let y = NEIGHBORHOOD_RADIUS; y < height - NEIGHBORHOOD_RADIUS; y += 1) {
    for (let x = NEIGHBORHOOD_RADIUS; x < width - NEIGHBORHOOD_RADIUS; x += 1) {
      if (shouldYield(budget)) {
        await yieldSearch(budget, signal)
      }
      const pixel = y * width + x
      if (valid[pixel] === 0) {
        continue
      }
      let localEnergy = 0
      let localCount = 0
      for (let dy = -NEIGHBORHOOD_RADIUS; dy <= NEIGHBORHOOD_RADIUS; dy += 1) {
        for (let dx = -NEIGHBORHOOD_RADIUS; dx <= NEIGHBORHOOD_RADIUS; dx += 1) {
          const neighbor = pixel + dy * width + dx
          if (valid[neighbor] === 0) {
            continue
          }
          localEnergy += magnitude[neighbor] * magnitude[neighbor]
          localCount += 1
        }
      }
      const localRms = Math.sqrt(
        localEnergy / localCount + LOCAL_GRADIENT_NOISE_FLOOR * LOCAL_GRADIENT_NOISE_FLOOR
      )
      const weight = Math.min(LOCAL_GRADIENT_WEIGHT_CAP, magnitude[pixel] / localRms)
      cosine[pixel] *= weight
      sine[pixel] *= weight
    }
  }

  return { width, height, hasEnergy, valid, cosine, sine }
}

async function findEdgeAlignment(
  { portrait, candidate, signal }: PortraitEdgeInput,
  requirements: PortraitEdgeRequirements,
  minSimilarity?: number
): Promise<PortraitEdgeScore | null> {
  signal.throwIfAborted()
  validateImage(candidate)
  const budget: SearchBudget = { evaluatedPixels: 0, workSinceYield: 0 }
  const raster = await portraitRaster(portrait, budget, signal)
  const template = await describeEdges(portrait.image, raster, budget, signal)
  const { width, height } = template
  const samples: EdgeSample[] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (shouldYield(budget)) {
        await yieldSearch(budget, signal)
      }
      const pixel = y * width + x
      const cosine = template.cosine[pixel]
      const sine = template.sine[pixel]
      const energy = cosine * cosine + sine * sine
      if (template.valid[pixel] === 0 || energy === 0) {
        continue
      }
      const candidateOffset = y * candidate.width + x
      samples.push({ candidateOffset, cosine, sine, energy })
    }
  }
  signal.throwIfAborted()
  if (samples.length < requirements.minComparedPixels) {
    return null
  }
  const candidateRaster = { width: candidate.width, height: candidate.height, scale: 1 }
  const features = await describeEdges(candidate, candidateRaster, budget, signal)
  signal.throwIfAborted()
  if (!features.hasEnergy) {
    return null
  }
  let best: PortraitEdgeScore | null = null
  for (let y = 0; y <= candidate.height - height; y += 1) {
    for (let x = 0; x <= candidate.width - width; x += 1) {
      const origin = y * candidate.width + x
      let comparedPixels = 0
      let product = 0
      let templateEnergy = 0
      let candidateEnergy = 0
      for (const sample of samples) {
        // 투명하거나 가려진 후보도 방문 비용이 있으므로 유효성 검사 전에 예산을 센다.
        if (shouldYield(budget, true)) {
          await yieldSearch(budget, signal)
        }
        const pixel = origin + sample.candidateOffset
        if (features.valid[pixel] === 0) {
          continue
        }
        const cosine = features.cosine[pixel]
        const sine = features.sine[pixel]
        comparedPixels += 1
        product += sample.cosine * cosine + sample.sine * sine
        templateEnergy += sample.energy
        candidateEnergy += cosine * cosine + sine * sine
      }
      const coverage = comparedPixels / samples.length
      if (
        comparedPixels < requirements.minComparedPixels ||
        coverage < requirements.minCoverage ||
        candidateEnergy === 0
      ) {
        continue
      }
      const cosineSimilarity = product / Math.sqrt(templateEnergy * candidateEnergy)
      const similarity = Math.max(MIN_SIMILARITY, Math.min(MAX_SIMILARITY, cosineSimilarity))
      if (minSimilarity !== undefined && similarity < minSimilarity) {
        continue
      }

      if (
        best === null ||
        similarity > best.similarity ||
        (similarity === best.similarity && coverage > best.coverage)
      ) {
        const alignment = { x, y, width, height }
        best = { similarity, comparedPixels, coverage, alignment }
      }

      if (minSimilarity !== undefined) {
        signal.throwIfAborted()

        return best
      }
    }
  }
  signal.throwIfAborted()

  return best
}

/** 필요한 비교량을 충족하는 정렬 중 색 변화에 덜 민감한 경계 유사도가 가장 큰 위치를 찾는다. */
export async function scoreCharacterPortraitEdges(
  input: PortraitEdgeInput,
  requirements: PortraitEdgeRequirements
): Promise<PortraitEdgeScore | null> {
  validateRequirements(requirements)
  const { minCoverage, minComparedPixels } = requirements

  return findEdgeAlignment(input, { minCoverage, minComparedPixels })
}

/** 표본으로 검증한 일치 기준을 주입한다. 운영용 유사도와 최소 비교량 기본값은 없다. */
export function createPortraitEdgeMatcher(
  policy: PortraitEdgeMatchPolicy
): (input: PortraitEdgeInput) => Promise<boolean> {
  validateRequirements(policy)
  if (
    !Number.isFinite(policy.minSimilarity) ||
    policy.minSimilarity < 0 ||
    policy.minSimilarity > MAX_SIMILARITY
  ) {
    throw new TypeError('Invalid portrait edge similarity threshold')
  }
  const { minCoverage, minComparedPixels, minSimilarity } = policy
  const requirements = { minCoverage, minComparedPixels }

  return async (input) => {
    const score = await findEdgeAlignment(input, requirements, minSimilarity)

    return score !== null
  }
}

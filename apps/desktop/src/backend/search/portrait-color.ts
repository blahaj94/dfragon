import type { CharacterImage, CharacterPortrait } from '../../preload/common/types/character'
import type { PortraitAnchor } from './portrait-anchor'
import {
  ALPHA_CHANNEL,
  countComparisonStep,
  createSearchBudget,
  findOpaqueBounds,
  type OpaqueBounds,
  type PortraitRaster,
  RGBA_CHANNELS,
  rasterizePortrait,
  type SearchBudget,
  shouldYield,
  validateImage,
  yieldSearch
} from './portrait-raster'

const RGB_CHANNELS = 3

/** 계산량 한도이며 비교 해상도의 권장값이 아니다. */
export const PORTRAIT_COLOR_LIMITS = { gridSize: 32 } as const

export type PortraitColorPolicy = Readonly<{
  /** 얼굴과 후보 창을 나눌 가로, 세로 셀 수. */
  gridSize: number
  /** 비교한 셀 면적 중 후보의 불투명 픽셀 비율 하한. */
  minCoverage: number
  /** 얼굴과 후보 양쪽에 픽셀이 있는 셀 수의 하한. */
  minComparedCells: number
  /** 기준 위치가 없을 때 후보 창의 위쪽 끝이 놓일 수 있는 범위를 후보 불투명 영역 높이의 위쪽 비율로 제한한다. */
  topFraction: number
  /** 기준 위치가 있을 때 창을 옮겨 볼 가로, 세로 거리(px). 기준 위치의 측정 오차를 흡수한다. */
  anchorRadius: number
}>

/** 셀 평균 RGB의 거리이며 확률이나 일치 판정이 아니다. */
export type PortraitColorScore = Readonly<{
  /** 비교한 셀의 평균 RGB 채널 절대 차이 평균(0 ~ 255). */
  distance: number
  /** 얼굴 유효 픽셀이 있는 셀 면적 중 후보 창의 불투명 픽셀 비율. */
  coverage: number
  comparedCells: number
  /** zoom=1 후보 이미지에서 정규화된 얼굴 크기 창의 좌상단 정수 좌표와 크기. */
  alignment: Readonly<{ x: number; y: number; width: number; height: number }>
}>

export type PortraitColorInput = Readonly<{
  portrait: CharacterPortrait
  candidate: CharacterImage
  /** 후보 직업으로 아는 얼굴 창 위치. null이면 불투명 영역의 위쪽에서 창을 찾는다. */
  anchor: PortraitAnchor | null
  signal: AbortSignal
}>

export type PortraitColorScorer = (input: PortraitColorInput) => Promise<PortraitColorScore | null>

/** 얼굴 셀의 창 내부 좌표(끝 제외)와 유효 픽셀 평균 RGB. */
type FaceCell = Readonly<{
  left: number
  top: number
  right: number
  bottom: number
  red: number
  green: number
  blue: number
}>
type FaceCells = Readonly<{
  width: number
  height: number
  cells: readonly FaceCell[]
  area: number
}>
type SearchRange = Readonly<{ firstX: number; lastX: number; firstY: number; lastY: number }>
/** 검색 영역 원점 기준 (stride × (영역 높이 + 1)) 누적합. */
type CandidateIntegral = Readonly<{
  originX: number
  originY: number
  stride: number
  red: Uint32Array
  green: Uint32Array
  blue: Uint32Array
  opaque: Uint32Array
}>

function validatePolicy(policy: PortraitColorPolicy): void {
  if (
    policy == null ||
    !Number.isSafeInteger(policy.gridSize) ||
    policy.gridSize < 1 ||
    policy.gridSize > PORTRAIT_COLOR_LIMITS.gridSize ||
    !Number.isFinite(policy.minCoverage) ||
    policy.minCoverage <= 0 ||
    policy.minCoverage > 1 ||
    !Number.isSafeInteger(policy.minComparedCells) ||
    policy.minComparedCells < 1 ||
    policy.minComparedCells > policy.gridSize * policy.gridSize ||
    !Number.isFinite(policy.topFraction) ||
    policy.topFraction <= 0 ||
    policy.topFraction > 1 ||
    !Number.isSafeInteger(policy.anchorRadius) ||
    policy.anchorRadius < 0
  ) {
    throw new TypeError('Invalid portrait color comparison policy')
  }
}

function cellEdges(length: number, gridSize: number): number[] {
  return Array.from({ length: gridSize + 1 }, (_, index) => Math.floor((index * length) / gridSize))
}

/** 유효 픽셀이 없는 셀은 비교에서 빼고, 유효 픽셀이 모두 같은 색이면 구분 정보가 없다고 본다. */
function summarizeFace(raster: PortraitRaster, gridSize: number): FaceCells | null {
  const { width, height, rgba, valid } = raster
  if (width < gridSize || height < gridSize) {
    throw new RangeError('Normalized portrait is smaller than the comparison grid')
  }
  const columns = cellEdges(width, gridSize)
  const rows = cellEdges(height, gridSize)
  const cells: FaceCell[] = []
  let area = 0
  let firstColor: number | undefined
  let informative = false
  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      const left = columns[column]
      const right = columns[column + 1]
      const top = rows[row]
      const bottom = rows[row + 1]
      let red = 0
      let green = 0
      let blue = 0
      let count = 0
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const pixel = y * width + x
          if (valid[pixel] === 0) {
            continue
          }
          const offset = pixel * RGBA_CHANNELS
          const color = (rgba[offset] << 16) | (rgba[offset + 1] << 8) | rgba[offset + 2]
          firstColor ??= color
          if (color !== firstColor) {
            informative = true
          }
          red += rgba[offset]
          green += rgba[offset + 1]
          blue += rgba[offset + 2]
          count += 1
        }
      }

      if (count === 0) {
        continue
      }
      area += (right - left) * (bottom - top)
      cells.push({
        left,
        top,
        right,
        bottom,
        red: red / count,
        green: green / count,
        blue: blue / count
      })
    }
  }

  if (!informative) {
    return null
  }

  return { width, height, cells, area }
}

/** 창은 이미지 안에 두고 기준 위치에서 anchorRadius 안의 위치만 본다. */
function anchorRange(
  candidate: CharacterImage,
  anchor: PortraitAnchor,
  face: FaceCells,
  anchorRadius: number
): SearchRange | null {
  const firstX = Math.max(0, anchor.x - anchorRadius)
  const lastX = Math.min(anchor.x + anchorRadius, candidate.width - face.width)
  const firstY = Math.max(0, anchor.y - anchorRadius)
  const lastY = Math.min(anchor.y + anchorRadius, candidate.height - face.height)
  if (lastX < firstX || lastY < firstY) {
    return null
  }

  return { firstX, lastX, firstY, lastY }
}

/** 창은 이미지 안에 두고 불투명 영역과 겹칠 수 있는 위치 중 위쪽 끝이 topFraction 범위인 곳만 본다. */
function searchRange(
  candidate: CharacterImage,
  bounds: OpaqueBounds,
  face: FaceCells,
  topFraction: number
): SearchRange | null {
  const opaqueHeight = bounds.bottom - bounds.top + 1
  const firstX = Math.max(0, bounds.left - face.width + 1)
  const lastX = Math.min(bounds.right, candidate.width - face.width)
  const firstY = Math.max(0, bounds.top - face.height + 1)
  const lastY = Math.min(
    bounds.top + Math.ceil(opaqueHeight * topFraction) - 1,
    candidate.height - face.height
  )
  if (lastX < firstX || lastY < firstY) {
    return null
  }

  return { firstX, lastX, firstY, lastY }
}

/** 검색 창이 닿는 영역만 불투명 픽셀의 채널 합과 개수를 누적한다. */
async function integrateCandidate(
  candidate: CharacterImage,
  range: SearchRange,
  face: FaceCells,
  budget: SearchBudget,
  signal: AbortSignal
): Promise<CandidateIntegral> {
  const regionWidth = range.lastX + face.width - range.firstX
  const regionHeight = range.lastY + face.height - range.firstY
  const stride = regionWidth + 1
  const size = stride * (regionHeight + 1)
  const red = new Uint32Array(size)
  const green = new Uint32Array(size)
  const blue = new Uint32Array(size)
  const opaque = new Uint32Array(size)
  for (let y = 0; y < regionHeight; y += 1) {
    let rowRed = 0
    let rowGreen = 0
    let rowBlue = 0
    let rowOpaque = 0
    for (let x = 0; x < regionWidth; x += 1) {
      if (shouldYield(budget)) {
        await yieldSearch(budget, signal)
      }
      const offset = ((range.firstY + y) * candidate.width + range.firstX + x) * RGBA_CHANNELS
      if (candidate.rgba[offset + ALPHA_CHANNEL] !== 0) {
        rowRed += candidate.rgba[offset]
        rowGreen += candidate.rgba[offset + 1]
        rowBlue += candidate.rgba[offset + 2]
        rowOpaque += 1
      }
      const index = (y + 1) * stride + x + 1
      red[index] = red[index - stride] + rowRed
      green[index] = green[index - stride] + rowGreen
      blue[index] = blue[index - stride] + rowBlue
      opaque[index] = opaque[index - stride] + rowOpaque
    }
  }

  return { originX: range.firstX, originY: range.firstY, stride, red, green, blue, opaque }
}

function rectangleSum(
  values: Uint32Array,
  stride: number,
  left: number,
  top: number,
  right: number,
  bottom: number
): number {
  return (
    values[bottom * stride + right] -
    values[top * stride + right] -
    values[bottom * stride + left] +
    values[top * stride + left]
  )
}

async function findBestWindow(
  face: FaceCells,
  integral: CandidateIntegral,
  range: SearchRange,
  policy: PortraitColorPolicy,
  budget: SearchBudget,
  signal: AbortSignal
): Promise<PortraitColorScore | null> {
  const { stride } = integral
  let best: PortraitColorScore | null = null
  for (let y = range.firstY; y <= range.lastY; y += 1) {
    for (let x = range.firstX; x <= range.lastX; x += 1) {
      const originX = x - integral.originX
      const originY = y - integral.originY
      let channelError = 0
      let comparedCells = 0
      let opaquePixels = 0
      for (const cell of face.cells) {
        countComparisonStep(budget)
        if (shouldYield(budget)) {
          await yieldSearch(budget, signal)
        }
        const left = originX + cell.left
        const right = originX + cell.right
        const top = originY + cell.top
        const bottom = originY + cell.bottom
        const count = rectangleSum(integral.opaque, stride, left, top, right, bottom)
        if (count === 0) {
          continue
        }
        const red = rectangleSum(integral.red, stride, left, top, right, bottom) / count
        const green = rectangleSum(integral.green, stride, left, top, right, bottom) / count
        const blue = rectangleSum(integral.blue, stride, left, top, right, bottom) / count
        channelError +=
          Math.abs(cell.red - red) + Math.abs(cell.green - green) + Math.abs(cell.blue - blue)
        comparedCells += 1
        opaquePixels += count
      }

      const coverage = opaquePixels / face.area
      if (comparedCells < policy.minComparedCells || coverage < policy.minCoverage) {
        continue
      }
      const distance = channelError / (comparedCells * RGB_CHANNELS)
      // 같은 거리면 더 많은 셀을 비교한 창, 그다음 위쪽, 왼쪽 창을 고른다.
      if (
        best === null ||
        distance < best.distance ||
        (distance === best.distance && comparedCells > best.comparedCells)
      ) {
        const alignment = { x, y, width: face.width, height: face.height }
        best = { distance, coverage, comparedCells, alignment }
      }
    }
  }

  return best
}

/**
 * 크롭을 마친 얼굴과 후보 stand 이미지를 같은 N×N 셀 평균 RGB로 비교해 거리가 가장 작은 창을 찾는다. 기준
 * 위치가 있으면 그 주변만 비교한다. 비교할 셀이 없거나 기준을 만족하는 창이 없으면 null이며, 취소와 계산
 * 예산 초과는 그대로 던진다.
 */
export function createPortraitColorScorer(policy: PortraitColorPolicy): PortraitColorScorer {
  validatePolicy(policy)
  const { gridSize, minCoverage, minComparedCells, topFraction, anchorRadius } = policy
  const accepted = { gridSize, minCoverage, minComparedCells, topFraction, anchorRadius }

  return async ({ portrait, candidate, anchor, signal }) => {
    signal.throwIfAborted()
    validateImage(candidate)
    const budget = createSearchBudget()
    const raster = await rasterizePortrait(portrait, budget, signal)
    const face = summarizeFace(raster, accepted.gridSize)
    signal.throwIfAborted()
    if (face === null) {
      return null
    }
    const bounds = await findOpaqueBounds(candidate, budget, signal)
    signal.throwIfAborted()
    if (bounds === null) {
      return null
    }
    const range =
      anchor === null
        ? searchRange(candidate, bounds, face, accepted.topFraction)
        : anchorRange(candidate, anchor, face, accepted.anchorRadius)
    if (range === null) {
      return null
    }
    const integral = await integrateCandidate(candidate, range, face, budget, signal)
    const best = await findBestWindow(face, integral, range, accepted, budget, signal)
    signal.throwIfAborted()

    return best
  }
}

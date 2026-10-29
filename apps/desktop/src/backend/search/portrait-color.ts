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

export type PortraitColorPolicy = Readonly<{
  gridSize: number
  minCoverage: number
  minComparedCells: number
  topFraction: number
  anchorRadius: number
}>

export type PortraitColorScore = Readonly<{
  distance: number
  coverage: number
  comparedCells: number
  alignment: Readonly<{ x: number; y: number; width: number; height: number }>
}>

export type PortraitColorInput = Readonly<{
  portrait: CharacterPortrait
  candidate: CharacterImage
  anchor: PortraitAnchor | null
  signal: AbortSignal
}>

export type PortraitColorScorer = (input: PortraitColorInput) => Promise<PortraitColorScore | null>

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
type CandidateIntegral = Readonly<{
  originX: number
  originY: number
  stride: number
  red: Uint32Array
  green: Uint32Array
  blue: Uint32Array
  opaque: Uint32Array
}>

function cellEdges(length: number, gridSize: number): number[] {
  return Array.from({ length: gridSize + 1 }, (_, index) => Math.floor((index * length) / gridSize))
}

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

export function createPortraitColorScorer(policy: PortraitColorPolicy): PortraitColorScorer {
  return async ({ portrait, candidate, anchor, signal }) => {
    signal.throwIfAborted()
    validateImage(candidate)
    const budget = createSearchBudget()
    const raster = await rasterizePortrait(portrait, budget, signal)
    const face = summarizeFace(raster, policy.gridSize)
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
      anchor !== null
        ? anchorRange(candidate, anchor, face, policy.anchorRadius)
        : searchRange(candidate, bounds, face, policy.topFraction)
    if (range === null) {
      return null
    }
    const integral = await integrateCandidate(candidate, range, face, budget, signal)
    const best = await findBestWindow(face, integral, range, policy, budget, signal)
    signal.throwIfAborted()

    return best
  }
}

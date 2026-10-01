// Private pixel matching for the measured participant-window heading.
export type ParticipantGrayFrame = { width: number; height: number; pixels: Uint8Array }
export type ParticipantAnchor = { x: number; y: number; scale: number }
export type ParticipantHeading = { x: number; y: number; scale: number; score: number }
export type ParticipantHeadingLayout = {
  width: number
  height: number
  anchorX: number
  anchorY: number
}
type HeadingMatch = ParticipantHeading | 'search-limit' | null

const partyHeadingLayout: ParticipantHeadingLayout = {
  width: 368,
  height: 17,
  anchorX: 360,
  anchorY: -15
}

// Measured red-icon evidence; these thresholds select candidates, not successful dialogs.
const anchorPolicy = {
  minRed: 130,
  minRedGreenDifference: 75,
  minRedBlueDifference: 55,
  minSizePx: 6,
  maxSizePx: 30,
  minAspectRatio: 0.65,
  maxAspectRatio: 1.5,
  minFillRatio: 0.45,
  referenceSizePx: 9
}

const searchPolicy = {
  maxAnchors: 128,
  sparseHeadingTargetSamples: 512,
  maxFrameComparisonSamples: 64_000_000,
  minCoarseCorrelation: 0.6,
  minFinalCorrelation: 0.68,
  coarseScale: {
    included: [1, 1.8],
    min: 0.64,
    max: 2.4,
    minAnchorFactor: 0.78,
    maxAnchorFactor: 1.24,
    endPadding: 0.01,
    step: 0.02,
    roundingFactor: 100
  },
  anchorPosition: { xRadiusReferencePx: 5, yRadiusReferencePx: 4, paddingPx: 3 },
  refinement: { scaleRadiusSteps: 10, scaleStep: 0.0025, positionRadiusPx: 2 }
}

/** The dense scale search is symmetric around the coarse match, including its center. */
export function participantRefinementScales(center: number): number[] {
  const { scaleRadiusSteps, scaleStep } = searchPolicy.refinement

  return Array.from(
    { length: 2 * scaleRadiusSteps + 1 },
    (_, index) => center + (index - scaleRadiusSteps) * scaleStep
  )
}

type Pattern = {
  width: number
  height: number
  offsets: Int32Array
  weights: Float64Array
  energy: number
}

/** Uses the experiment's ties-to-even rounding for raster boundaries. */
export function roundParticipantPixel(value: number): number {
  const floor = Math.floor(value)
  // Scale refinement and projection can move a mathematical half by a few float ulps.
  const tolerance = 4 * Number.EPSILON * Math.max(1, Math.abs(value))
  if (Math.abs(value - floor - 0.5) <= tolerance) {
    return floor + Math.abs(floor % 2)
  }

  return Math.round(value)
}

/** Builds a grayscale copy; raw RGBA is kept intact for the eventual crops. */
export function participantGrayscale(rgba: Uint8Array | Uint8ClampedArray): Uint8Array {
  const gray = new Uint8Array(rgba.length / 4)
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4
    gray[index] = Math.round(
      0.299 * rgba[offset] + 0.587 * rgba[offset + 1] + 0.114 * rgba[offset + 2]
    )
  }

  return gray
}

/** Finds bounded red components over the entire frame, using eight-neighbor connectivity. */
export function findParticipantAnchors(
  width: number,
  height: number,
  rgba: Uint8Array | Uint8ClampedArray
): ParticipantAnchor[] | null {
  const mask = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4
    const red = rgba[offset]
    mask[index] = Number(
      red >= anchorPolicy.minRed &&
        red - rgba[offset + 1] >= anchorPolicy.minRedGreenDifference &&
        red - rgba[offset + 2] >= anchorPolicy.minRedBlueDifference
    )
  }

  const anchors: ParticipantAnchor[] = []
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] === 0) {
      continue
    }
    mask[start] = 0
    queue[0] = start
    let read = 0
    let count = 1
    let left = start % width
    let right = left
    let top = Math.floor(start / width)
    let bottom = top
    while (read < count) {
      const pixel = queue[read++]
      const x = pixel % width
      const y = Math.floor(pixel / width)
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
      for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny += 1) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx += 1) {
          const neighbor = ny * width + nx
          if (mask[neighbor] !== 0) {
            mask[neighbor] = 0
            queue[count++] = neighbor
          }
        }
      }
    }
    const w = right - left + 1
    const h = bottom - top + 1
    if (
      w < anchorPolicy.minSizePx ||
      w > anchorPolicy.maxSizePx ||
      h < anchorPolicy.minSizePx ||
      h > anchorPolicy.maxSizePx ||
      w / h < anchorPolicy.minAspectRatio ||
      w / h > anchorPolicy.maxAspectRatio
    ) {
      continue
    }

    if (count / (w * h) < anchorPolicy.minFillRatio) {
      continue
    }
    const x = (left + right) / 2
    const y = (top + bottom) / 2
    const scale = Math.sqrt(w * h) / anchorPolicy.referenceSizePx
    anchors.push({ x, y, scale })
    // Do not silently choose a subset on a pathological or unsupported frame.
    if (anchors.length > searchPolicy.maxAnchors) {
      return null
    }
  }

  return anchors
}

/** Resizes the small heading with half-pixel bilinear sampling and centers its intensities. */
function headingPattern(
  heading: Uint8Array,
  layout: ParticipantHeadingLayout,
  width: number,
  height: number,
  frameWidth: number,
  sparse: boolean
): Pattern {
  const step = sparse
    ? Math.ceil(Math.sqrt((width * height) / searchPolicy.sparseHeadingTargetSamples))
    : 1
  const values: number[] = []
  const offsets: number[] = []
  for (let y = 0; y < height; y += step) {
    const sy = Math.max(0, Math.min(layout.height - 1, ((y + 0.5) * layout.height) / height - 0.5))
    const y0 = Math.floor(sy)
    const y1 = Math.min(layout.height - 1, y0 + 1)
    for (let x = 0; x < width; x += step) {
      const sx = Math.max(0, Math.min(layout.width - 1, ((x + 0.5) * layout.width) / width - 0.5))
      const x0 = Math.floor(sx)
      const x1 = Math.min(layout.width - 1, x0 + 1)
      const upper =
        heading[y0 * layout.width + x0] * (1 - (sx - x0)) +
        heading[y0 * layout.width + x1] * (sx - x0)
      const lower =
        heading[y1 * layout.width + x0] * (1 - (sx - x0)) +
        heading[y1 * layout.width + x1] * (sx - x0)
      values.push(Math.round(upper * (1 - (sy - y0)) + lower * (sy - y0)))
      offsets.push(y * frameWidth + x)
    }
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const weights = Float64Array.from(values, (value) => value - mean)
  const energy = weights.reduce((sum, value) => sum + value * value, 0)
  const patternOffsets = Int32Array.from(offsets)

  return { width, height, offsets: patternOffsets, weights, energy }
}

/** Mean-centered normalized correlation, not a probability or OCR confidence. */
function headingScore(frame: ParticipantGrayFrame, pattern: Pattern, x: number, y: number): number {
  let sum = 0
  let squares = 0
  let product = 0
  const start = y * frame.width + x
  for (let index = 0; index < pattern.offsets.length; index += 1) {
    const value = frame.pixels[start + pattern.offsets[index]]
    sum += value
    squares += value * value
    product += value * pattern.weights[index]
  }
  const energy = squares - (sum * sum) / pattern.offsets.length
  if (energy <= 0 || pattern.energy <= 0) {
    return -1
  }

  return Math.min(1, product / Math.sqrt(energy * pattern.energy))
}

/** Keeps all template/pattern state local to one frame, without a process-global cache. */
export function createParticipantHeadingMatcher(
  frame: ParticipantGrayFrame,
  heading: Uint8Array,
  hasRows?: (x: number, y: number, scale: number) => boolean,
  layout: ParticipantHeadingLayout = partyHeadingLayout
) {
  const patterns = new Map<string, Pattern>()
  // Shared by every anchor and both search passes; never return a partial candidate set.
  let remainingSamples = searchPolicy.maxFrameComparisonSamples

  function boundedScore(pattern: Pattern, x: number, y: number): number | null {
    if (pattern.offsets.length > remainingSamples) {
      return null
    }
    remainingSamples -= pattern.offsets.length

    return headingScore(frame, pattern, x, y)
  }

  function patternFor(scale: number, sparse: boolean): Pattern {
    const width = roundParticipantPixel(layout.width * scale)
    const height = roundParticipantPixel(layout.height * scale)
    const key = `${width}:${height}:${sparse}`
    let pattern = patterns.get(key)
    if (pattern == null) {
      pattern = headingPattern(heading, layout, width, height, frame.width, sparse)
      patterns.set(key, pattern)
    }

    return pattern
  }

  function search(anchor: ParticipantAnchor, scales: number[], dense: boolean): HeadingMatch {
    let best: ParticipantHeading | null = null
    for (const scale of scales) {
      const pattern = patternFor(scale, true)
      const px = Math.trunc(anchor.x - layout.anchorX * scale)
      const py = Math.trunc(anchor.y - layout.anchorY * scale)
      const dx =
        Math.trunc(searchPolicy.anchorPosition.xRadiusReferencePx * scale) +
        searchPolicy.anchorPosition.paddingPx
      const dy =
        Math.trunc(searchPolicy.anchorPosition.yRadiusReferencePx * scale) +
        searchPolicy.anchorPosition.paddingPx
      const left = Math.max(0, px - dx)
      const right = Math.min(frame.width - pattern.width, px + dx)
      const top = Math.max(0, py - dy)
      const bottom = Math.min(frame.height - pattern.height, py + dy)
      let peak: ParticipantHeading | null = null
      for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
          if (hasRows && !hasRows(x, y, scale)) {
            continue
          }
          const score = boundedScore(pattern, x, y)
          if (score == null) {
            return 'search-limit'
          }

          if (peak == null || score > peak.score) {
            peak = { x, y, scale, score }
          }
        }
      }
      if (peak == null) {
        continue
      }

      if (dense) {
        const full = patternFor(scale, false)
        const center = peak
        peak = null
        const radius = searchPolicy.refinement.positionRadiusPx
        for (
          let y = Math.max(top, center.y - radius);
          y <= Math.min(bottom, center.y + radius);
          y += 1
        ) {
          for (
            let x = Math.max(left, center.x - radius);
            x <= Math.min(right, center.x + radius);
            x += 1
          ) {
            if (hasRows && !hasRows(x, y, scale)) {
              continue
            }
            const score = boundedScore(full, x, y)
            if (score == null) {
              return 'search-limit'
            }

            if (peak == null || score > peak.score) {
              peak = { x, y, scale, score }
            }
          }
        }
      }

      if (peak != null && (best == null || peak.score > best.score)) {
        best = peak
      }
    }

    return best
  }

  return (anchor: ParticipantAnchor): HeadingMatch => {
    const scales = new Set<number>(searchPolicy.coarseScale.included)
    const start = Math.max(
      searchPolicy.coarseScale.min,
      anchor.scale * searchPolicy.coarseScale.minAnchorFactor
    )
    const end =
      Math.min(
        searchPolicy.coarseScale.max,
        anchor.scale * searchPolicy.coarseScale.maxAnchorFactor
      ) + searchPolicy.coarseScale.endPadding
    for (let scale = start; scale < end; scale += searchPolicy.coarseScale.step) {
      scales.add(
        Math.round(scale * searchPolicy.coarseScale.roundingFactor) /
          searchPolicy.coarseScale.roundingFactor
      )
    }
    const coarse = search(
      anchor,
      [...scales].sort((a, b) => a - b),
      false
    )
    if (coarse === 'search-limit') {
      return coarse
    }

    if (coarse == null || coarse.score < searchPolicy.minCoarseCorrelation) {
      return null
    }
    const refined = search(anchor, participantRefinementScales(coarse.scale), true)
    if (refined === 'search-limit') {
      return refined
    }

    if (refined != null && refined.score >= searchPolicy.minFinalCorrelation) {
      return refined
    }

    return null
  }
}

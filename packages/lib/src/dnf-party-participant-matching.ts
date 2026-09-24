// Private pixel matching for the measured participant-window heading.
export type ParticipantGrayFrame = { width: number; height: number; pixels: Uint8Array }
export type ParticipantAnchor = { x: number; y: number; scale: number }
export type ParticipantHeading = { x: number; y: number; scale: number; score: number }

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
  return value - floor === 0.5 ? floor + Math.abs(floor % 2) : Math.round(value)
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
    mask[index] = Number(red >= 130 && red - rgba[offset + 1] >= 75 && red - rgba[offset + 2] >= 55)
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
    if (w < 6 || w > 30 || h < 6 || h > 30 || w / h < 0.65 || w / h > 1.5) {
      continue
    }
    if (count / (w * h) < 0.45) {
      continue
    }
    anchors.push({ x: (left + right) / 2, y: (top + bottom) / 2, scale: Math.sqrt(w * h) / 9 })
    // Do not silently choose a subset on a pathological or unsupported frame.
    if (anchors.length > 128) {
      return null
    }
  }
  return anchors
}

/** Resizes the small heading with half-pixel bilinear sampling and centers its intensities. */
function headingPattern(
  heading: Uint8Array,
  width: number,
  height: number,
  frameWidth: number,
  sparse: boolean
): Pattern {
  const step = sparse ? Math.ceil(Math.sqrt((width * height) / 512)) : 1
  const values: number[] = []
  const offsets: number[] = []
  for (let y = 0; y < height; y += step) {
    const sy = Math.max(0, Math.min(16, ((y + 0.5) * 17) / height - 0.5))
    const y0 = Math.floor(sy)
    const y1 = Math.min(16, y0 + 1)
    for (let x = 0; x < width; x += step) {
      const sx = Math.max(0, Math.min(367, ((x + 0.5) * 368) / width - 0.5))
      const x0 = Math.floor(sx)
      const x1 = Math.min(367, x0 + 1)
      const upper = heading[y0 * 368 + x0] * (1 - (sx - x0)) + heading[y0 * 368 + x1] * (sx - x0)
      const lower = heading[y1 * 368 + x0] * (1 - (sx - x0)) + heading[y1 * 368 + x1] * (sx - x0)
      values.push(Math.round(upper * (1 - (sy - y0)) + lower * (sy - y0)))
      offsets.push(y * frameWidth + x)
    }
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const weights = Float64Array.from(values, (value) => value - mean)
  const energy = weights.reduce((sum, value) => sum + value * value, 0)
  return { width, height, offsets: Int32Array.from(offsets), weights, energy }
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
export function createParticipantHeadingMatcher(frame: ParticipantGrayFrame, heading: Uint8Array) {
  const patterns = new Map<string, Pattern>()
  function patternFor(scale: number, sparse: boolean): Pattern {
    const width = roundParticipantPixel(368 * scale)
    const height = roundParticipantPixel(17 * scale)
    const key = `${width}:${height}:${sparse}`
    let pattern = patterns.get(key)
    if (pattern == null) {
      pattern = headingPattern(heading, width, height, frame.width, sparse)
      patterns.set(key, pattern)
    }
    return pattern
  }

  function search(
    anchor: ParticipantAnchor,
    scales: number[],
    dense: boolean
  ): ParticipantHeading | null {
    let best: ParticipantHeading | null = null
    for (const scale of scales) {
      const pattern = patternFor(scale, true)
      const px = Math.trunc(anchor.x - 360 * scale)
      const py = Math.trunc(anchor.y + 15 * scale)
      const dx = Math.trunc(5 * scale) + 3
      const dy = Math.trunc(4 * scale) + 3
      const left = Math.max(0, px - dx)
      const right = Math.min(frame.width - pattern.width, px + dx)
      const top = Math.max(0, py - dy)
      const bottom = Math.min(frame.height - pattern.height, py + dy)
      let peak: ParticipantHeading | null = null
      for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
          const score = headingScore(frame, pattern, x, y)
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
        for (let y = Math.max(top, center.y - 2); y <= Math.min(bottom, center.y + 2); y += 1) {
          for (let x = Math.max(left, center.x - 2); x <= Math.min(right, center.x + 2); x += 1) {
            const score = headingScore(frame, full, x, y)
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

  return (anchor: ParticipantAnchor): ParticipantHeading | null => {
    const scales = new Set<number>([1, 1.8])
    const start = Math.max(0.64, anchor.scale * 0.78)
    const end = Math.min(2.4, anchor.scale * 1.24) + 0.01
    for (let scale = start; scale < end; scale += 0.02) {
      scales.add(Math.round(scale * 100) / 100)
    }
    const coarse = search(
      anchor,
      [...scales].sort((a, b) => a - b),
      false
    )
    if (coarse == null || coarse.score < 0.6) {
      return null
    }
    const refined = search(
      anchor,
      Array.from({ length: 21 }, (_, index) => coarse.scale + (index - 10) * 0.0025),
      true
    )
    return refined != null && refined.score >= 0.68 ? refined : null
  }
}

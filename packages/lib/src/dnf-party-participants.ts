import type { DNFRectangle } from './dnf-party-geometry.js'
import {
  createParticipantHeadingMatcher,
  findParticipantAnchors,
  participantGrayscale,
  roundParticipantPixel as roundPixel,
  type ParticipantGrayFrame,
  type ParticipantHeading
} from './dnf-party-participant-matching.js'

export type DNFParticipantFrame = Readonly<{
  width: number
  height: number
  /** Row-major, unpremultiplied RGBA bytes; alpha is preserved but not used in detection. */
  rgba: Uint8Array | Uint8ClampedArray
}>
export type DNFParticipantSlot = 1 | 2 | 3 | 4
export type DNFParticipantRow = {
  slot: DNFParticipantSlot
  occupied: boolean
  nickname: DNFRectangle
}
type Unavailable = { status: 'not-found' | 'ambiguous' | 'search-limit' }
type Found = {
  status: 'found'
  scale: number
  /** Normalized heading correlation, not a correctness probability. */
  matchScore: number
  window: DNFRectangle
  /** Always four entries in screen order, including empty/locked rows. */
  rows: DNFParticipantRow[]
}
export type DNFParticipantDetection = Found | Unavailable
export type DNFParticipantCropResult =
  | Unavailable
  | (Omit<Found, 'rows'> & {
      rows: (DNFParticipantRow & { crop: DNFParticipantFrame | null })[]
    })

/** Rejects malformed or unbounded pixel inputs before scanning or allocating buffers. */
function validateFrame(frame: DNFParticipantFrame, heading = false): void {
  if (
    frame == null ||
    !Number.isSafeInteger(frame.width) ||
    !Number.isSafeInteger(frame.height) ||
    frame.width < 1 ||
    frame.height < 1 ||
    frame.width > 1920 ||
    frame.height > 1080 ||
    !(frame.rgba instanceof Uint8Array || frame.rgba instanceof Uint8ClampedArray) ||
    frame.rgba.length !== frame.width * frame.height * 4 ||
    (heading && (frame.width !== 368 || frame.height !== 17)) ||
    (!heading && (frame.width < 1067 || frame.height < 600))
  ) {
    throw new RangeError(
      'DNF participant detection requires bounded RGBA frames and a 368x17 heading.'
    )
  }
}

/** Projects all edges from the matched heading; never clips a partially visible dialog. */
function rectangle(
  heading: ParticipantHeading,
  left: number,
  top: number,
  right: number,
  bottom: number
): DNFRectangle {
  const x = roundPixel(heading.x + left * heading.scale)
  const y = roundPixel(heading.y + top * heading.scale)
  return {
    x,
    y,
    width: roundPixel(heading.x + right * heading.scale) - x,
    height: roundPixel(heading.y + bottom * heading.scale) - y
  }
}

/** Confirms the four fixed row separators, including separators around empty slots. */
function hasParticipantRows(frame: ParticipantGrayFrame, heading: ParticipantHeading): boolean {
  for (let slot = 0; slot < 4; slot += 1) {
    const top = roundPixel(heading.y + (17 + 22 * slot) * heading.scale)
    const left = roundPixel(heading.x + 4 * heading.scale)
    const right = roundPixel(heading.x + 364 * heading.scale)
    const radius = roundPixel(2 * heading.scale)
    let best = 0
    for (let y = top - radius; y <= top + radius; y += 1) {
      let dark = 0
      for (let x = left; x < right; x += 1) {
        if (frame.pixels[y * frame.width + x] < 40) {
          dark += 1
        }
      }
      best = Math.max(best, dark / (right - left))
    }
    if (best < 0.85) {
      return false
    }
  }
  return true
}

/** Measures evidence outside the name column so a gold padlock is not treated as a name. */
function evidenceRatio(frame: DNFParticipantFrame, region: DNFRectangle, colored = false): number {
  let count = 0
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      const offset = (y * frame.width + x) * 4
      const r = frame.rgba[offset]
      const g = frame.rgba[offset + 1]
      const b = frame.rgba[offset + 2]
      const maximum = Math.max(r, g, b)
      if (colored ? maximum >= 120 && maximum - Math.min(r, g, b) >= 60 : maximum >= 100) {
        count += 1
      }
    }
  }
  return count / (region.width * region.height)
}

/**
 * Finds the movable participant dialog using its red icon and caller-owned UI-0% heading.
 * No image decoding, capture, OCR, settings reads, or persistence is performed.
 * Requires a 368x17 RGBA reference of the four column labels and their background/borders.
 * Frame dimensions are bounded to the measured 1067..1920 by 600..1080 client range.
 */
export function detectDNFPartyParticipantWindow(
  frame: DNFParticipantFrame,
  headingTemplate: DNFParticipantFrame
): DNFParticipantDetection {
  validateFrame(frame)
  validateFrame(headingTemplate, true)
  const heading = participantGrayscale(headingTemplate.rgba)
  if (heading.every((value) => value === heading[0])) {
    throw new RangeError('DNF participant heading must contain contrast.')
  }
  const anchors = findParticipantAnchors(frame.width, frame.height, frame.rgba)
  if (anchors == null) {
    return { status: 'search-limit' }
  }
  const gray = {
    width: frame.width,
    height: frame.height,
    pixels: participantGrayscale(frame.rgba)
  }
  const matchHeading = createParticipantHeadingMatcher(gray, heading)
  const candidates: { heading: ParticipantHeading; window: DNFRectangle }[] = []
  for (const anchor of anchors) {
    const matched = matchHeading(anchor)
    if (matched == null) {
      continue
    }
    const window = rectangle(matched, -14, -67, 380, 143)
    if (
      window.x < 0 ||
      window.y < 0 ||
      window.x + window.width > frame.width ||
      window.y + window.height > frame.height ||
      !hasParticipantRows(gray, matched)
    ) {
      continue
    }
    const duplicate = candidates.find(
      ({ heading }) => Math.abs(heading.x - matched.x) < 15 && Math.abs(heading.y - matched.y) < 15
    )
    if (duplicate == null) {
      candidates.push({ heading: matched, window })
    } else if (matched.score > duplicate.heading.score) {
      Object.assign(duplicate, { heading: matched, window })
    }
  }
  if (candidates.length !== 1) {
    return { status: candidates.length === 0 ? 'not-found' : 'ambiguous' }
  }

  const { heading: matched, window } = candidates[0]
  const rows: DNFParticipantRow[] = Array.from({ length: 4 }, (_, index) => {
    const top = 17 + 22 * index
    const portrait = evidenceRatio(frame, rectangle(matched, 31, top + 2, 48, top + 18))
    const level = evidenceRatio(frame, rectangle(matched, 51, top + 2, 72, top + 18))
    const role = evidenceRatio(frame, rectangle(matched, 242, top + 2, 254, top + 18), true)
    return {
      slot: (index + 1) as DNFParticipantSlot,
      occupied: Number(portrait >= 0.12) + Number(level >= 0.035) + Number(role >= 0.1) >= 2,
      nickname: rectangle(matched, 154, top + 3, 238, top + 18)
    }
  })
  return { status: 'found', scale: matched.scale, matchScore: matched.score, window, rows }
}

/** Detects and copies from the same frame; empty rows stay in place with crop:null. */
export function cropDNFPartyParticipantNicknames(
  frame: DNFParticipantFrame,
  headingTemplate: DNFParticipantFrame
): DNFParticipantCropResult {
  const result = detectDNFPartyParticipantWindow(frame, headingTemplate)
  if (result.status !== 'found') {
    return result
  }
  return {
    ...result,
    rows: result.rows.map((row) => {
      if (!row.occupied) {
        return { ...row, crop: null }
      }
      const { x, y, width, height } = row.nickname
      const rgba = new Uint8Array(width * height * 4)
      for (let index = 0; index < height; index += 1) {
        const start = ((y + index) * frame.width + x) * 4
        rgba.set(frame.rgba.subarray(start, start + width * 4), index * width * 4)
      }
      return { ...row, crop: { width, height, rgba } }
    })
  }
}

import type { DNFRectangle } from './dnf-party-geometry.js'
import { projectParticipantRectangle } from './dnf-participant-regions.js'
import {
  hasParticipantEvidence,
  participantEvidenceRatio as evidenceRatio
} from './dnf-participant-evidence.js'
import type { DNFParticipantFrame } from './dnf-party-participants.js'
import {
  createParticipantHeadingMatcher,
  findParticipantAnchors,
  participantGrayscale,
  roundParticipantPixel as roundPixel,
  type ParticipantGrayFrame,
  type ParticipantHeading
} from './dnf-party-participant-matching.js'

export type DNFRaidParticipantPosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
export type DNFRaidParticipantRow = {
  /** One-based screen position in this frame, not a persistent participant identity. */
  row: DNFRaidParticipantPosition
  occupied: boolean
  nickname: DNFRectangle
  partyRegion: DNFRectangle
  equipmentScoreRegion: DNFRectangle
}
type Unavailable = { status: 'not-found' | 'ambiguous' | 'search-limit' }
type Found = {
  status: 'found'
  scale: number
  /** Normalized heading correlation, not an OCR accuracy or probability. */
  matchScore: number
  window: DNFRectangle
  /** Always twelve entries in current screen order, including empty rows. */
  rows: DNFRaidParticipantRow[]
}
export type DNFRaidParticipantDetection = Found | Unavailable
export type DNFRaidParticipantCropResult =
  | Unavailable
  | (Omit<Found, 'rows'> & {
      rows: (DNFRaidParticipantRow & { nicknameCrop: DNFParticipantFrame | null })[]
    })

const windowBounds = { left: -15, top: -68, right: 450, bottom: 324 }

const headingLayout = { width: 423, height: 18, anchorX: 405, anchorY: -10 }
const rowCount = 12
const rowSpacing = 21

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
    (heading && (frame.width !== headingLayout.width || frame.height !== headingLayout.height)) ||
    (!heading && (frame.width < 1067 || frame.height < 600))
  ) {
    throw new RangeError('DNF raid detection requires bounded RGBA frames and a 423x18 heading.')
  }
}

/** Rejects unrelated red decoration before spending the shared template-matching budget. */
function createRaidRowValidator(frame: ParticipantGrayFrame) {
  const stride = frame.width + 1
  const darkCounts = new Uint16Array(stride * frame.height)
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      darkCounts[y * stride + x + 1] =
        darkCounts[y * stride + x] + Number(frame.pixels[y * frame.width + x] < 40)
    }
  }

  return (x: number, y: number, scale: number): boolean => {
    const window = projectParticipantRectangle({ x, y, scale }, windowBounds)
    if (
      window.x < 0 ||
      window.y < 0 ||
      window.x + window.width > frame.width ||
      window.y + window.height > frame.height
    ) {
      return false
    }
    const left = roundPixel(x + 3 * scale)
    const right = roundPixel(x + 420 * scale)
    const radius = roundPixel(2 * scale)
    for (let row = 0; row < rowCount; row += 1) {
      const top = roundPixel(y + (headingLayout.height + rowSpacing * row) * scale)
      let found = false
      for (let line = top - radius; line <= top + radius; line += 1) {
        const count = darkCounts[line * stride + right] - darkCounts[line * stride + left]
        if (count / (right - left) >= 0.85) {
          found = true
          break
        }
      }
      if (!found) {
        return false
      }
    }

    return true
  }
}

/**
 * Finds the movable twelve-row raid detail dialog, using a caller-owned UI-0% heading.
 * The 423x18 reference includes all five column labels and the blank action-column header.
 * No decoding, capture, OCR, settings reads, or persistence is performed.
 * An eight-row special-raid layout is outside this measured layout's contract.
 */
export function detectDNFRaidParticipantWindow(
  frame: DNFParticipantFrame,
  headingTemplate: DNFParticipantFrame
): DNFRaidParticipantDetection {
  validateFrame(frame)
  validateFrame(headingTemplate, true)
  const heading = participantGrayscale(headingTemplate.rgba)
  if (heading.every((value) => value === heading[0])) {
    throw new RangeError('DNF raid heading must contain contrast.')
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
  const hasRows = createRaidRowValidator(gray)
  const matchHeading = createParticipantHeadingMatcher(gray, heading, hasRows, headingLayout)
  const candidates: { heading: ParticipantHeading; window: DNFRectangle }[] = []
  for (const anchor of anchors) {
    const matched = matchHeading(anchor)
    if (matched === 'search-limit') {
      return { status: 'search-limit' }
    }

    if (matched == null) {
      continue
    }
    const window = projectParticipantRectangle(matched, windowBounds)
    if (
      window.x < 0 ||
      window.y < 0 ||
      window.x + window.width > frame.width ||
      window.y + window.height > frame.height ||
      !hasRows(matched.x, matched.y, matched.scale)
    ) {
      continue
    }
    const duplicate = candidates.find(
      ({ heading: other }) =>
        Math.abs(other.x - matched.x) < 15 && Math.abs(other.y - matched.y) < 15
    )
    if (duplicate == null) {
      candidates.push({ heading: matched, window })
    } else if (matched.score > duplicate.heading.score) {
      Object.assign(duplicate, { heading: matched, window })
    }
  }
  if (candidates.length !== 1) {
    const status = candidates.length === 0 ? 'not-found' : 'ambiguous'

    return { status }
  }

  const { heading: matched, window } = candidates[0]
  const rows: DNFRaidParticipantRow[] = Array.from({ length: rowCount }, (_, index) => {
    const top = headingLayout.height + rowSpacing * index
    const portrait = evidenceRatio(
      frame,
      projectParticipantRectangle(matched, { left: 51, top: top + 2, right: 66, bottom: top + 18 })
    )
    const level = evidenceRatio(
      frame,
      projectParticipantRectangle(matched, { left: 85, top: top + 2, right: 104, bottom: top + 18 })
    )
    const role = evidenceRatio(
      frame,
      projectParticipantRectangle(matched, {
        left: 269,
        top: top + 2,
        right: 281,
        bottom: top + 18
      }),
      true
    )
    const row = (index + 1) as DNFRaidParticipantPosition
    const occupied = hasParticipantEvidence({ portrait, level, role })
    const nickname = projectParticipantRectangle(matched, {
      left: 182,
      top: top + 3,
      right: 268,
      bottom: top + 20
    })
    const partyRegion = projectParticipantRectangle(matched, {
      left: 3,
      top: top + 2,
      right: 45,
      bottom: top + 19
    })
    const equipmentScoreRegion = projectParticipantRectangle(matched, {
      left: 106,
      top: top + 3,
      right: 181,
      bottom: top + 20
    })

    return { row, occupied, nickname, partyRegion, equipmentScoreRegion }
  })

  return { status: 'found', scale: matched.scale, matchScore: matched.score, window, rows }
}

/** Copies raw nickname pixels from this frame; an empty row has nicknameCrop:null. */
export function cropDNFRaidParticipantNicknames(
  frame: DNFParticipantFrame,
  headingTemplate: DNFParticipantFrame
): DNFRaidParticipantCropResult {
  const result = detectDNFRaidParticipantWindow(frame, headingTemplate)
  if (result.status !== 'found') {
    return result
  }

  const detection = { ...result }
  const rows = result.rows.map((row) => {
    if (!row.occupied) {
      return { ...row, nicknameCrop: null }
    }
    const { x, y, width, height } = row.nickname
    const rgba = new Uint8Array(width * height * 4)
    for (let index = 0; index < height; index += 1) {
      const start = ((y + index) * frame.width + x) * 4
      rgba.set(frame.rgba.subarray(start, start + width * 4), index * width * 4)
    }
    const nicknameCrop = { width, height, rgba }

    return { ...row, nicknameCrop }
  })

  return { ...detection, rows }
}

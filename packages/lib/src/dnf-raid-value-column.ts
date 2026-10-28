import type { DNFRectangle } from './dnf-party-geometry.js'
import { participantGrayscale } from './dnf-party-participant-matching.js'
import type { DNFParticipantFrame } from './dnf-party-participants.js'
import { normalizedRegion, validateImage, validateRegion } from './dnf-raid-metadata.js'

export type DNFRaidValueColumnKind = 'fame' | 'equipment-score' | 'unknown'
export type DNFRaidValueHeadingTemplates = Readonly<{
  fame: DNFParticipantFrame
  equipmentScore: DNFParticipantFrame
}>
export type DNFRaidValueNotation = {
  min: number
  max: number
}

const headingLayout = { width: 75, height: 18 }
// The detector accepts client frames up to this edge, so the heading may lie beyond FHD.
const MAX_FRAME_EDGE = 8192
// Both labels share the cell background and toggle icon, so only the label strokes separate them.
// At 1067x600 a matching label scored 1.0 and the other label 0.395; the margins allow for
// enlarged dialogs, which no real sample covered yet.
const headingPolicy = { minCorrelation: 0.7, minCandidateGap: 0.15 }
const THOUSANDS_UNIT = 1000
const RAID_VALUE_NOTATION_PATTERN = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,3}))?(K)?$/
const DIGIT_GROUP_SEPARATOR_PATTERN = /,/g

function headingPattern(rgba: Uint8Array | Uint8ClampedArray): Float64Array | null {
  const gray = participantGrayscale(rgba)
  const values = new Float64Array(gray.length)
  let sum = 0
  for (const value of gray) {
    sum += value
  }
  const mean = sum / gray.length
  let energy = 0
  for (let index = 0; index < gray.length; index += 1) {
    values[index] = gray[index] - mean
    energy += values[index] * values[index]
  }
  if (energy === 0) {
    return null
  }
  const norm = Math.sqrt(energy)
  for (let index = 0; index < values.length; index += 1) {
    values[index] /= norm
  }

  return values
}

function templatePattern(image: DNFParticipantFrame): Float64Array {
  validateImage(image, headingLayout.width, headingLayout.height)
  if (image.width !== headingLayout.width || image.height !== headingLayout.height) {
    throw new RangeError('DNF raid value headings must be 75x18.')
  }
  const pattern = headingPattern(image.rgba)
  if (pattern == null) {
    throw new RangeError('DNF raid value headings must contain contrast.')
  }

  return pattern
}

function correlation(left: Float64Array, right: Float64Array): number {
  let score = 0
  for (let index = 0; index < left.length; index += 1) {
    score += left[index] * right[index]
  }

  return score
}

export function classifyDNFRaidValueColumn(
  frame: DNFParticipantFrame,
  region: DNFRectangle,
  templates: DNFRaidValueHeadingTemplates
): DNFRaidValueColumnKind {
  validateImage(frame, MAX_FRAME_EDGE, MAX_FRAME_EDGE)
  validateRegion(frame, region)
  if (templates == null) {
    throw new RangeError('DNF raid value heading references are required.')
  }
  const fame = templatePattern(templates.fame)
  const equipmentScore = templatePattern(templates.equipmentScore)
  const observed = headingPattern(
    normalizedRegion(frame, region, headingLayout.width, headingLayout.height)
  )
  if (observed == null) {
    return 'unknown'
  }
  const fameScore = correlation(observed, fame)
  const equipmentScoreScore = correlation(observed, equipmentScore)
  const best = Math.max(fameScore, equipmentScoreScore)
  if (
    best < headingPolicy.minCorrelation ||
    Math.abs(fameScore - equipmentScoreScore) < headingPolicy.minCandidateGap
  ) {
    return 'unknown'
  }

  if (fameScore > equipmentScoreScore) {
    return 'fame'
  }

  return 'equipment-score'
}

export function parseDNFRaidValueNotation(text: string): DNFRaidValueNotation | null {
  const match = RAID_VALUE_NOTATION_PATTERN.exec(text)
  if (match == null) {
    return null
  }
  const [, integerText, fractionText = '', thousands] = match
  if (fractionText !== '' && thousands == null) {
    return null
  }
  const digits = Number(integerText.replace(DIGIT_GROUP_SEPARATOR_PATTERN, '') + fractionText)
  const fractionUnit = 10 ** fractionText.length
  const multiplier = thousands == null ? 1 : THOUSANDS_UNIT
  const scaled = digits * multiplier
  if (!Number.isSafeInteger(scaled)) {
    return null
  }
  const min = scaled / fractionUnit
  const hiddenUnit = thousands == null ? 1 : THOUSANDS_UNIT / fractionUnit
  const max = min + hiddenUnit - 1
  if (!Number.isSafeInteger(max)) {
    return null
  }

  return { min, max }
}

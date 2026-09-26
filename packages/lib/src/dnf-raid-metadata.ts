import type { DNFRectangle } from './dnf-party-geometry.js'
import { participantGrayscale } from './dnf-party-participant-matching.js'
import type { DNFParticipantFrame } from './dnf-party-participants.js'
import type { DNFRaidParticipantPosition, DNFRaidParticipantRow } from './dnf-raid-participants.js'

export type DNFRaidParty = 'R' | 'Y' | 'G' | '싱글'
export type DNFRaidScoreGlyph =
  '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | '.' | 'K'
export type DNFRaidMetadataTemplates = Readonly<{
  /** UI-0% 42x17 party regions, including each actual badge and its background. */
  parties: readonly Readonly<{ party: DNFRaidParty; image: DNFParticipantFrame }>[]
  /**
   * UI-0% single-glyph crops, 1..16 pixels wide and 17 pixels high.
   * Preserve the score region's vertical position, including comma/decimal baselines.
   * All nonzero columns of a glyph must be present; horizontal padding is optional.
   */
  equipmentScoreGlyphs: readonly Readonly<{
    character: DNFRaidScoreGlyph
    image: DNFParticipantFrame
  }>[]
}>
export type DNFRaidParticipantMetadata = {
  row: DNFRaidParticipantPosition
  party: DNFRaidParty | null
  /** Exact visible notation, including commas, decimal points and K; never converted to a number. */
  equipmentScoreText: string | null
}
type MetadataRow = Pick<
  DNFRaidParticipantRow,
  'row' | 'occupied' | 'partyRegion' | 'equipmentScoreRegion'
>
type GlyphPattern = { width: number; pixels: Uint8Array; count: number }

function validateImage(image: DNFParticipantFrame, maxWidth: number, maxHeight: number): void {
  if (
    image == null ||
    !Number.isSafeInteger(image.width) ||
    !Number.isSafeInteger(image.height) ||
    image.width < 1 ||
    image.height < 1 ||
    image.width > maxWidth ||
    image.height > maxHeight ||
    !(image.rgba instanceof Uint8Array || image.rgba instanceof Uint8ClampedArray) ||
    image.rgba.length !== image.width * image.height * 4
  ) {
    throw new RangeError('DNF raid metadata requires bounded RGBA images.')
  }
}

function validateRegion(image: DNFParticipantFrame, region: DNFRectangle): void {
  if (
    region == null ||
    ![region.x, region.y, region.width, region.height].every(Number.isSafeInteger) ||
    region.x < 0 ||
    region.y < 0 ||
    region.width < 1 ||
    region.height < 1 ||
    region.width > 192 ||
    region.height > 48 ||
    region.x + region.width > image.width ||
    region.y + region.height > image.height
  ) {
    throw new RangeError('DNF raid metadata regions must be complete and bounded inside the frame.')
  }
}

/** Normalize only a disposable field copy; caller-owned source pixels are never modified. */
function normalizedRegion(
  image: DNFParticipantFrame,
  region: DNFRectangle,
  width: number,
  height: number
): Uint8Array {
  const rgba = new Uint8Array(width * height * 4)
  // Keep one-pixel glyph gaps intact when reducing an enlarged UI raster.
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(region.height - 1, Math.floor(((y + 0.5) * region.height) / height))
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(region.width - 1, Math.floor(((x + 0.5) * region.width) / width))
      const source = ((region.y + sy) * image.width + region.x + sx) * 4
      rgba.set(image.rgba.subarray(source, source + 4), (y * width + x) * 4)
    }
  }
  return rgba
}

/** Per-channel evidence keeps colored R/Y/G badges distinct even when their borders coincide. */
function partyPattern(rgba: Uint8Array | Uint8ClampedArray): Float64Array {
  const values = new Float64Array((rgba.length / 4) * 3)
  let sum = 0
  let hasSpatialContrast = false
  for (let pixel = 0; pixel < rgba.length / 4; pixel += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = rgba[pixel * 4 + channel]
      hasSpatialContrast ||= value !== rgba[channel]
      values[pixel * 3 + channel] = value
      sum += value
    }
  }
  if (!hasSpatialContrast) {
    return new Float64Array(values.length)
  }
  const mean = sum / values.length
  let energy = 0
  for (let index = 0; index < values.length; index += 1) {
    values[index] -= mean
    energy += values[index] * values[index]
  }
  if (energy > 0) {
    const norm = Math.sqrt(energy)
    for (let index = 0; index < values.length; index += 1) {
      values[index] /= norm
    }
  }
  return values
}

function readParty(
  rgba: Uint8Array,
  templates: readonly { party: DNFRaidParty; pixels: Float64Array }[]
): DNFRaidParty | null {
  const pattern = partyPattern(rgba)
  const scores = new Map<DNFRaidParty, number>()
  for (const template of templates) {
    let score = 0
    for (let index = 0; index < pattern.length; index += 1) {
      score += pattern[index] * template.pixels[index]
    }
    scores.set(template.party, Math.max(scores.get(template.party) ?? -1, score))
  }
  const ranked = [...scores].sort((left, right) => right[1] - left[1])
  const best = ranked[0]
  return best != null && best[1] >= 0.8 && best[1] - (ranked[1]?.[1] ?? -1) >= 0.06 ? best[0] : null
}

/**
 * DNF's colored digits have a dark one-pixel shadow. Local contrast removes both
 * text-color variation and the smooth gold selected-row background at the measured scale.
 */
function scoreMask(rgba: Uint8Array | Uint8ClampedArray, width: number): Uint8Array {
  const gray = participantGrayscale(rgba)
  const mask = new Uint8Array(gray.length)
  // Bottom two rows are the row separator/highlight edge, not score text.
  for (let y = 1; y < 15; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let minimum = gray[y * width + x]
      for (let ny = y - 1; ny <= y + 1; ny += 1) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx += 1) {
          minimum = Math.min(minimum, gray[ny * width + nx])
        }
      }
      mask[y * width + x] = Number(gray[y * width + x] - minimum >= 55)
    }
  }
  return mask
}

function scoreGlyphs(mask: Uint8Array, width: number): GlyphPattern[] {
  const columns = new Uint8Array(width)
  for (let y = 0; y < 17; y += 1) {
    for (let x = 0; x < width; x += 1) {
      columns[x] += mask[y * width + x]
    }
  }
  const result: GlyphPattern[] = []
  let x = 0
  while (x < width) {
    if (columns[x] === 0) {
      x += 1
      continue
    }
    const left = x
    let count = 0
    while (x < width && columns[x] !== 0) {
      count += columns[x]
      x += 1
    }
    const glyphWidth = x - left
    const pixels = new Uint8Array(glyphWidth * 17)
    for (let y = 0; y < 17; y += 1) {
      pixels.set(mask.subarray(y * width + left, y * width + x), y * glyphWidth)
    }
    result.push({ width: glyphWidth, pixels, count })
  }
  return result
}

function readEquipmentScore(
  rgba: Uint8Array,
  templates: readonly { character: DNFRaidScoreGlyph; pattern: GlyphPattern }[]
): string | null {
  const glyphs = scoreGlyphs(scoreMask(rgba, 75), 75)
  if (glyphs.length === 0 || glyphs.length > 16) {
    return null
  }
  let text = ''
  for (const glyph of glyphs) {
    const scores = new Map<DNFRaidScoreGlyph, number>()
    for (const template of templates) {
      if (glyph.width !== template.pattern.width) {
        continue
      }
      let intersection = 0
      for (let index = 0; index < glyph.pixels.length; index += 1) {
        intersection += glyph.pixels[index] * template.pattern.pixels[index]
      }
      const score = intersection / (glyph.count + template.pattern.count - intersection)
      scores.set(template.character, Math.max(scores.get(template.character) ?? -1, score))
    }
    const ranked = [...scores].sort((left, right) => right[1] - left[1])
    const best = ranked[0]
    if (best == null || best[1] < 0.8 || best[1] - (ranked[1]?.[1] ?? -1) < 0.08) {
      return null
    }
    text += best[0]
  }
  // Reject malformed/partial readings, while preserving every accepted display character.
  return /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?K?$/.test(text) ? text : null
}

/**
 * Reads each occupied row's actual pixels using caller-owned UI-0% references.
 * Returns null independently for unsupported/ambiguous fields and for empty rows;
 * use the detector's occupied flag to distinguish those cases. No OCR engine,
 * image decoder, filesystem, capture, persistence or network access is performed.
 */
export function readDNFRaidParticipantMetadata(
  frame: DNFParticipantFrame,
  rows: readonly MetadataRow[],
  templates: DNFRaidMetadataTemplates
): DNFRaidParticipantMetadata[] {
  validateImage(frame, 1920, 1080)
  if (!Array.isArray(rows) || rows.length > 12) {
    throw new RangeError('DNF raid metadata accepts at most twelve distinct rows.')
  }
  const positions = new Set<number>()
  for (const row of rows) {
    if (
      row == null ||
      !Number.isInteger(row.row) ||
      row.row < 1 ||
      row.row > 12 ||
      positions.has(row.row) ||
      typeof row.occupied !== 'boolean'
    ) {
      throw new RangeError('DNF raid metadata accepts at most twelve distinct rows.')
    }
    positions.add(row.row)
    validateRegion(frame, row.partyRegion)
    validateRegion(frame, row.equipmentScoreRegion)
  }
  if (
    templates == null ||
    !Array.isArray(templates.parties) ||
    templates.parties.length < 1 ||
    templates.parties.length > 8 ||
    !Array.isArray(templates.equipmentScoreGlyphs) ||
    templates.equipmentScoreGlyphs.length < 1 ||
    templates.equipmentScoreGlyphs.length > 26
  ) {
    throw new RangeError('DNF raid metadata requires bounded party and score reference sets.')
  }
  const parties = Array.from(templates.parties, (template) => {
    if (template == null || !['R', 'Y', 'G', '싱글'].includes(template.party)) {
      throw new RangeError('DNF raid metadata party references must identify a supported badge.')
    }
    validateImage(template.image, 42, 17)
    if (template.image.width !== 42 || template.image.height !== 17) {
      throw new RangeError('DNF raid metadata party references must be 42x17.')
    }
    const pixels = partyPattern(template.image.rgba)
    if (pixels.every((value) => value === 0)) {
      throw new RangeError('DNF raid metadata party references must contain contrast.')
    }
    return { party: template.party, pixels }
  })
  const equipmentScoreGlyphs = Array.from(templates.equipmentScoreGlyphs, (template) => {
    if (
      template == null ||
      typeof template.character !== 'string' ||
      !/^[0-9,.K]$/.test(template.character)
    ) {
      throw new RangeError('DNF raid metadata score references must identify one supported glyph.')
    }
    validateImage(template.image, 16, 17)
    if (template.image.height !== 17) {
      throw new RangeError('DNF raid metadata score references must preserve the 17px baseline.')
    }
    const patterns = scoreGlyphs(
      scoreMask(template.image.rgba, template.image.width),
      template.image.width
    )
    if (patterns.length !== 1) {
      throw new RangeError('DNF raid metadata score references must contain exactly one glyph.')
    }
    return { character: template.character, pattern: patterns[0] }
  })

  return rows.map((row) => {
    if (!row.occupied) {
      return { row: row.row, party: null, equipmentScoreText: null }
    }
    return {
      row: row.row,
      party: readParty(normalizedRegion(frame, row.partyRegion, 42, 17), parties),
      equipmentScoreText: readEquipmentScore(
        normalizedRegion(frame, row.equipmentScoreRegion, 75, 17),
        equipmentScoreGlyphs
      )
    }
  })
}

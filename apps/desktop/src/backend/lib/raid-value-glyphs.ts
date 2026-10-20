import type { DNFParticipantFrame, DNFRaidMetadataTemplates, DNFRaidScoreGlyph } from '@dfragon/lib'

const RGBA_CHANNELS = 4

/**
 * `raid-value-glyphs.png`에 왼쪽부터 이어 붙인 수치 글자와 각 글자의 폭. 글자 사이에 여백은 없고 높이는
 * 모두 17px이다. 글자를 더하거나 바꾸면 sprite와 이 표를 함께 고친다.
 */
const RAID_VALUE_GLYPH_LAYOUT: readonly Readonly<{
  character: DNFRaidScoreGlyph
  width: number
}>[] = [
  { character: '0', width: 7 },
  { character: '1', width: 4 },
  { character: '2', width: 7 },
  { character: '3', width: 7 },
  { character: '4', width: 7 },
  { character: '5', width: 7 },
  { character: '6', width: 7 },
  { character: '7', width: 7 },
  { character: '8', width: 7 },
  { character: '9', width: 7 },
  { character: ',', width: 4 },
  { character: '.', width: 3 },
  { character: 'K', width: 7 }
]

/** 수치 글자 sprite를 글자마다 잘라 판독기의 글자 기준으로 바꾼다. 픽셀은 바꾸지 않는다. */
export function sliceRaidValueGlyphs(
  sprite: DNFParticipantFrame
): DNFRaidMetadataTemplates['equipmentScoreGlyphs'] {
  const spriteWidth = RAID_VALUE_GLYPH_LAYOUT.reduce((sum, glyph) => sum + glyph.width, 0)
  if (sprite.width !== spriteWidth) {
    throw new RangeError('The raid value glyph sprite does not match its layout.')
  }
  let left = 0

  return RAID_VALUE_GLYPH_LAYOUT.map(({ character, width }) => {
    const rgba = new Uint8Array(width * sprite.height * RGBA_CHANNELS)
    for (let y = 0; y < sprite.height; y += 1) {
      const start = (y * sprite.width + left) * RGBA_CHANNELS
      rgba.set(
        sprite.rgba.subarray(start, start + width * RGBA_CHANNELS),
        y * width * RGBA_CHANNELS
      )
    }
    left += width
    const image = { width, height: sprite.height, rgba }

    return { character, image }
  })
}

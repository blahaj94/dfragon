import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import { expect, it } from 'vitest'
import { readDNFRaidParticipantValues } from '@dfragon/lib'
import { sliceRaidValueGlyphs } from './raid-value-glyphs'

function readSprite() {
  const { width, height, data } = PNG.sync.read(
    readFileSync(new URL('./raid-value-glyphs.png', import.meta.url))
  )

  return { width, height, rgba: data }
}

it('수치 글자 sprite를 0~9, 쉼표, 마침표, K 순서로 잘라 판독기가 받는 한 글자 기준으로 만든다', () => {
  const glyphs = sliceRaidValueGlyphs(readSprite())

  expect(glyphs.map((glyph) => glyph.character).join('')).toBe('0123456789,.K')
  expect(glyphs.every((glyph) => glyph.image.height === 17)).toBe(true)
  // 판독기는 기준마다 글자가 정확히 하나인지 검사하므로, 잘못 자르면 여기서 RangeError가 난다.
  const frame = { width: 1, height: 1, rgba: new Uint8Array(4) }
  expect(() => readDNFRaidParticipantValues(frame, [], glyphs)).not.toThrow()
})

// 두 표기로 sprite의 13글자를 모두 한 번 이상 그린다.
it.each(['12,345.6K', '7,890'])(
  '잘라 낸 글자로 수치 칸에 %s를 그리면 판독기가 같은 표기로 읽는다',
  (text) => {
    const glyphs = sliceRaidValueGlyphs(readSprite())
    // 수치 칸(UI 0%, 75×17)을 글자 배경색으로 채운 뒤 글자를 왼쪽부터 붙인다.
    const width = 75
    const height = 17
    const rgba = new Uint8Array(width * height * 4)
    const background = glyphs[0].image.rgba.subarray(0, 4)
    for (let offset = 0; offset < rgba.length; offset += 4) {
      rgba.set(background, offset)
    }
    let left = 0
    for (const character of text) {
      const glyph = glyphs.find((entry) => entry.character === character)!.image
      for (let y = 0; y < height; y += 1) {
        const row = glyph.rgba.subarray(y * glyph.width * 4, (y + 1) * glyph.width * 4)
        rgba.set(row, (y * width + left) * 4)
      }
      left += glyph.width
    }
    const region = { x: 0, y: 0, width, height }
    const rows = [{ row: 1 as const, occupied: true, equipmentScoreRegion: region }]

    expect(readDNFRaidParticipantValues({ width, height, rgba }, rows, glyphs)).toEqual([
      { row: 1, valueText: text }
    ])
  }
)

it('표와 폭이 다른 sprite는 자르지 않는다', () => {
  const sprite = readSprite()
  const narrow = {
    width: sprite.width - 1,
    height: 17,
    rgba: new Uint8Array((sprite.width - 1) * 17 * 4)
  }

  expect(() => sliceRaidValueGlyphs(narrow)).toThrow(RangeError)
})

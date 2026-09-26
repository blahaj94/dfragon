import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readDNFRaidParticipantMetadata } from '@dfragon/lib'

// Artificial glyphs and badges only; no screenshots, game assets or player data.
const alphabet = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  ',': ['01', '01', '10'],
  '.': ['1']
}

function frame(width, height, color = [16, 19, 23, 255]) {
  const rgba = new Uint8Array(width * height * 4)
  for (let index = 0; index < rgba.length; index += 4) {
    rgba.set(color, index)
  }
  return { width, height, rgba }
}

function paint(image, x, y, width, height, color) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      image.rgba.set(color, (row * image.width + column) * 4)
    }
  }
}

function copy(source, target, left, top, scale = 1) {
  const width = Math.round(source.width * scale)
  const height = Math.round(source.height * scale)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(source.width - 1, Math.floor(x / scale))
      const sy = Math.min(source.height - 1, Math.floor(y / scale))
      const offset = (sy * source.width + sx) * 4
      paint(target, left + x, top + y, 1, 1, source.rgba.subarray(offset, offset + 4))
    }
  }
}

function glyph(character, color = [205, 210, 225, 255]) {
  const pixels = alphabet[character]
  const image = frame(pixels[0].length + 2, 17)
  const top = character === ',' || character === '.' ? 11 : 4
  for (const [y, row] of pixels.entries()) {
    for (const [x, value] of [...row].entries()) {
      if (value === '1') {
        paint(image, x + 1, top + y, 1, 1, color)
      }
    }
  }
  return image
}

function badge(party) {
  const color = {
    R: [150, 25, 30, 255],
    Y: [180, 155, 25, 255],
    G: [45, 145, 25, 255],
    싱글: [115, 115, 115, 255]
  }[party]
  const image = frame(42, 17)
  paint(image, 1, 2, 38, 12, color)
  const symbol = { R: '2', Y: '7', G: '6', 싱글: '8' }[party]
  copy(glyph(symbol), image, 16, 0)
  if (party === '싱글') {
    copy(glyph('1'), image, 23, 0)
  }
  return image
}

const templates = {
  parties: ['R', 'Y', 'G', '싱글'].map((party) => ({ party, image: badge(party) })),
  equipmentScoreGlyphs: Object.keys(alphabet).map((character) => ({
    character,
    image: glyph(character)
  }))
}

function score(text, color = [205, 210, 225, 255], gold = false) {
  const image = frame(75, 17)
  if (gold) {
    for (let y = 0; y < 17; y += 1) {
      paint(image, 0, y, 75, 1, [18 + y * 3, 16 + y * 2, 8, 255])
    }
    // The bright bottom separator must not be mistaken for a digit.
    paint(image, 40, 15, 35, 1, [200, 170, 30, 255])
  }
  let left = 3
  for (const character of text) {
    const imageGlyph = glyph(character, color)
    for (let y = 1; y < 15; y += 1) {
      for (let x = 0; x < imageGlyph.width; x += 1) {
        const offset = (y * imageGlyph.width + x) * 4
        if (imageGlyph.rgba[offset] === color[0]) {
          paint(image, left + x, y, 1, 1, color)
        }
      }
    }
    left += imageGlyph.width
  }
  return image
}

function fixture(values, scale = 1) {
  const image = frame(640, 600)
  const rows = values.map(
    ({ party = 'R', text = '123,456', occupied = true, gold = false, color }, index) => {
      const top = 20 + index * 42
      const partyRegion = {
        x: 20,
        y: top,
        width: Math.round(42 * scale),
        height: Math.round(17 * scale)
      }
      const equipmentScoreRegion = {
        x: 130,
        y: top,
        width: Math.round(75 * scale),
        height: Math.round(17 * scale)
      }
      copy(badge(party), image, partyRegion.x, partyRegion.y, scale)
      copy(score(text, color, gold), image, equipmentScoreRegion.x, equipmentScoreRegion.y, scale)
      return { row: index + 1, occupied, partyRegion, equipmentScoreRegion }
    }
  )
  return { image, rows }
}

test('reads actual per-row badges and preserves visible score notation across twelve rows', () => {
  const values = [
    { party: 'G', text: '1000.4K', gold: true },
    { party: '싱글', text: '123,456' },
    { party: 'R', text: '0042' },
    { party: 'Y', text: '0', color: [125, 200, 80, 255] },
    { party: '싱글', text: '123.40K', gold: true, color: [205, 200, 75, 255] },
    { party: 'G', text: '987,654' },
    { party: 'R', text: '42', occupied: false },
    { party: '싱글', text: '12K' },
    { party: 'Y', text: '999.9K' },
    { party: 'R', text: '101' },
    { party: 'G', text: '321' },
    { party: 'Y', text: '123,456', occupied: false }
  ]
  const { image, rows } = fixture(values)
  const original = image.rgba.slice()
  const referenceCopies = templates.equipmentScoreGlyphs.map(({ image }) => image.rgba.slice())

  const actual = readDNFRaidParticipantMetadata(image, rows, templates)

  assert.deepEqual(
    actual,
    values.map((value, index) => ({
      row: index + 1,
      party: value.occupied === false ? null : value.party,
      equipmentScoreText: value.occupied === false ? null : value.text
    }))
  )
  assert.deepEqual(image.rgba, original)
  for (const [index, template] of templates.equipmentScoreGlyphs.entries()) {
    assert.deepEqual(template.image.rgba, referenceCopies[index])
  }
})

test('normalizes scaled field copies, including the detector upper scale boundary', () => {
  for (const scale of [1.8, 2.425]) {
    const { image, rows } = fixture(
      [
        { party: '싱글', text: '1000.4K' },
        { party: 'G', text: '123,456' }
      ],
      scale
    )
    assert.deepEqual(readDNFRaidParticipantMetadata(image, rows, templates), [
      { row: 1, party: '싱글', equipmentScoreText: '1000.4K' },
      { row: 2, party: 'G', equipmentScoreText: '123,456' }
    ])
  }
})

test('returns independent nulls for ambiguous badges, unreadable scores and empty rows', () => {
  const { image, rows } = fixture([{ party: 'R' }, { party: 'G' }, { occupied: false }])
  const first = rows[0].partyRegion
  paint(image, first.x, first.y, first.width, first.height, [0, 0, 0, 255])
  const second = rows[1].equipmentScoreRegion
  paint(image, second.x, second.y, second.width, second.height, [0, 0, 0, 255])
  paint(image, second.x + 10, second.y + 5, 11, 7, [255, 255, 255, 255])
  assert.deepEqual(readDNFRaidParticipantMetadata(image, rows, templates), [
    { row: 1, party: null, equipmentScoreText: '123,456' },
    { row: 2, party: 'G', equipmentScoreText: null },
    { row: 3, party: null, equipmentScoreText: null }
  ])

  const clean = fixture([{ party: 'R', text: '42' }])
  const ambiguous = {
    ...templates,
    parties: [
      { party: 'R', image: badge('R') },
      { party: 'Y', image: badge('R') }
    ]
  }
  assert.equal(readDNFRaidParticipantMetadata(clean.image, clean.rows, ambiguous)[0].party, null)
})

test('rejects ambiguous glyphs and malformed score syntax without trimming or guessing', () => {
  const { image, rows } = fixture([
    { text: ',123' },
    { text: '12,34' },
    { text: '.5K' },
    { text: '1K2' }
  ])
  assert.ok(
    readDNFRaidParticipantMetadata(image, rows, templates).every(
      (row) => row.equipmentScoreText === null
    )
  )
  const clean = fixture([{ text: '8' }])
  const ambiguous = {
    ...templates,
    equipmentScoreGlyphs: [...templates.equipmentScoreGlyphs, { character: '0', image: glyph('8') }]
  }
  assert.equal(
    readDNFRaidParticipantMetadata(clean.image, clean.rows, ambiguous)[0].equipmentScoreText,
    null
  )
})

test('requires bounded complete regions, distinct screen rows, and valid pixel references', () => {
  const { image, rows } = fixture([{}])
  for (const invalid of [
    null,
    { ...image, width: 1921 },
    { ...image, height: NaN },
    { ...image, rgba: new Uint16Array(image.rgba.length) },
    { ...image, rgba: image.rgba.subarray(4) }
  ]) {
    assert.throws(() => readDNFRaidParticipantMetadata(invalid, rows, templates), RangeError)
  }
  for (const invalid of [
    null,
    [...rows, rows[0]],
    [{ ...rows[0], row: 13 }],
    [{ ...rows[0], occupied: 1 }],
    [{ ...rows[0], partyRegion: { x: -1, y: 0, width: 42, height: 17 } }],
    [{ ...rows[0], equipmentScoreRegion: { x: 639, y: 0, width: 75, height: 17 } }]
  ]) {
    assert.throws(() => readDNFRaidParticipantMetadata(image, invalid, templates), RangeError)
  }
  for (const invalid of [
    null,
    { ...templates, parties: [] },
    { ...templates, parties: Array(1) },
    { ...templates, equipmentScoreGlyphs: Array(1) },
    { ...templates, parties: [{ party: 'R', image: frame(42, 17, [180, 40, 50, 255]) }] },
    { ...templates, equipmentScoreGlyphs: [] },
    { ...templates, parties: [{ party: 'B', image: badge('R') }] },
    { ...templates, parties: [{ party: 'R', image: frame(41, 17) }] },
    { ...templates, equipmentScoreGlyphs: [{ character: 1, image: glyph('1') }] },
    { ...templates, equipmentScoreGlyphs: [{ character: 'k', image: glyph('K') }] },
    { ...templates, equipmentScoreGlyphs: [{ character: '1', image: frame(7, 16) }] },
    { ...templates, equipmentScoreGlyphs: [{ character: '1', image: frame(7, 17) }] }
  ]) {
    assert.throws(() => readDNFRaidParticipantMetadata(image, rows, invalid), RangeError)
  }
})

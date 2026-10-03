import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readDNFRaidParticipantMetadata } from '@dfragon/lib'

const testTitles = {
  visibleNotation: '12행의 합성 표식을 읽고 표시된 점수 문자열을 유지한다',
  scaledFields: '검출 배율 상한까지 확대된 필드의 사본을 기준 크기로 맞춘다',
  independentNulls: '모호한 표식·미판독 점수·빈 행을 독립적인 null로 반환한다',
  malformedScores: '모호한 글자와 잘못된 점수 형식을 보정·추측 없이 거절한다',
  validation: '완전한 영역·중복 없는 화면 행·유효한 기준 픽셀을 요구한다',
  contrastBoundary: '국소 대비 경계를 포함하고 아래 구분선 두 행을 점수에서 제외한다',
  glyphBoundary: '글자 획의 겹침 경계를 포함하고 별도로 16글자 상한을 유지한다',
  independentAmbiguity: '같은 기준 높이에서도 표식과 글자의 모호성 판정을 독립적으로 유지한다',
  sparseReadonlyRows:
    '일부 행의 입력 순서와 화면 행 번호를 유지하고 RGBA view·기준 이미지를 변경하지 않는다',
  regionBoundaries: '빈 행도 완전한 정수 영역을 요구하고 사각형 크기·화면 끝 경계를 포함한다',
  referenceSetLimits: '같은 표식·글자의 여러 기준은 모호하지 않으며 기준 개수 상한을 포함한다'
}

// 합성 글자·배지만 사용하며 스크린샷·게임 자산·플레이어 데이터는 포함하지 않는다.
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
  parties: ['R', 'Y', 'G', '싱글'].map((party) => {
    const image = badge(party)

    return { party, image }
  }),
  equipmentScoreGlyphs: Object.keys(alphabet).map((character) => {
    const image = glyph(character)

    return { character, image }
  })
}

function score(text, color = [205, 210, 225, 255], gold = false) {
  const image = frame(75, 17)
  if (gold) {
    for (let y = 0; y < 17; y += 1) {
      paint(image, 0, y, 75, 1, [18 + y * 3, 16 + y * 2, 8, 255])
    }
    // 밝은 아래 구분선을 숫자의 획으로 읽지 않아야 한다.
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
      const row = index + 1

      return { row, occupied, partyRegion, equipmentScoreRegion }
    }
  )

  return { image, rows }
}

test(testTitles.visibleNotation, () => {
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
    values.map((value, index) => {
      const row = index + 1
      const party = value.occupied === false ? null : value.party
      const equipmentScoreText = value.occupied === false ? null : value.text

      return { row, party, equipmentScoreText }
    })
  )
  assert.deepEqual(image.rgba, original)
  for (const [index, template] of templates.equipmentScoreGlyphs.entries()) {
    assert.deepEqual(template.image.rgba, referenceCopies[index])
  }
})

test(testTitles.scaledFields, () => {
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

test(testTitles.independentNulls, () => {
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

test(testTitles.malformedScores, () => {
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

test(testTitles.validation, () => {
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

test(testTitles.contrastBoundary, () => {
  for (const [brightness, expected] of [
    [73, null],
    [74, '8'],
    [75, '8']
  ]) {
    // 배경의 반올림 휘도는 19이므로 글자 획의 대비는 각각 54·55·56이다.
    const { image, rows } = fixture([
      { text: '8', color: [brightness, brightness, brightness, 255] }
    ])
    const region = rows[0].equipmentScoreRegion
    const original = image.rgba.slice()

    assert.equal(
      readDNFRaidParticipantMetadata(image, rows, templates)[0].equipmentScoreText,
      expected
    )
    assert.deepEqual(image.rgba, original)
    paint(image, region.x, region.y + 15, region.width, 2, [255, 255, 255, 255])
    assert.equal(
      readDNFRaidParticipantMetadata(image, rows, templates)[0].equipmentScoreText,
      expected
    )
  }
})

test(testTitles.glyphBoundary, () => {
  const reference = frame(3, 17, [0, 0, 0, 255])
  paint(reference, 1, 3, 1, 10, [255, 255, 255, 255])
  const narrowTemplates = {
    ...templates,
    equipmentScoreGlyphs: [{ character: '1', image: reference }]
  }
  for (const [strokeCount, expected] of [
    [7, null],
    [8, '1'],
    [9, '1']
  ]) {
    const { image, rows } = fixture([{ text: '' }])
    const region = rows[0].equipmentScoreRegion
    paint(image, region.x, region.y, region.width, region.height, [0, 0, 0, 255])
    paint(image, region.x + 3, region.y + 3, 1, strokeCount, [255, 255, 255, 255])

    assert.equal(
      readDNFRaidParticipantMetadata(image, rows, narrowTemplates)[0].equipmentScoreText,
      expected,
      `글자 획 ${strokeCount}/10 겹침`
    )
  }
  for (const count of [16, 17]) {
    const { image, rows } = fixture([{ text: '' }])
    const region = rows[0].equipmentScoreRegion
    paint(image, region.x, region.y, region.width, region.height, [0, 0, 0, 255])
    for (let index = 0; index < count; index += 1) {
      paint(image, region.x + 3 + 2 * index, region.y + 3, 1, 10, [255, 255, 255, 255])
    }
    const expected = count === 16 ? '1'.repeat(16) : null

    assert.equal(
      readDNFRaidParticipantMetadata(image, rows, narrowTemplates)[0].equipmentScoreText,
      expected
    )
  }
})

test(testTitles.independentAmbiguity, () => {
  const { image, rows } = fixture([{ party: 'R', text: '8' }])
  const ambiguousParties = [
    { party: 'R', image: badge('R') },
    { party: 'Y', image: badge('R') }
  ]
  const ambiguousGlyphs = [...templates.equipmentScoreGlyphs, { character: '0', image: glyph('8') }]

  assert.deepEqual(
    readDNFRaidParticipantMetadata(image, rows, { ...templates, parties: ambiguousParties }),
    [{ row: 1, party: null, equipmentScoreText: '8' }]
  )
  assert.deepEqual(
    readDNFRaidParticipantMetadata(image, rows, {
      ...templates,
      equipmentScoreGlyphs: ambiguousGlyphs
    }),
    [{ row: 1, party: 'R', equipmentScoreText: null }]
  )
  for (const invalid of [
    { ...templates, parties: [{ party: 'R', image: frame(43, 17) }] },
    { ...templates, parties: [{ party: 'R', image: frame(42, 18) }] },
    { ...templates, equipmentScoreGlyphs: [{ character: '1', image: frame(17, 17) }] },
    { ...templates, equipmentScoreGlyphs: [{ character: '1', image: frame(3, 18) }] }
  ]) {
    assert.throws(() => readDNFRaidParticipantMetadata(image, rows, invalid), RangeError)
  }
})

test(testTitles.sparseReadonlyRows, () => {
  const { image, rows } = fixture([
    { party: 'G', text: '1000.4K' },
    { party: 'Y', text: '0042' },
    { party: 'R', text: '12', occupied: false }
  ])
  const storage = new Uint8ClampedArray(image.rgba.length + 8).fill(211)
  storage.set(image.rgba, 4)
  const rgba = storage.subarray(4, storage.length - 4)
  for (let index = 3; index < rgba.length; index += 4) {
    rgba[index] = index % 256
  }
  const view = Object.freeze({ width: image.width, height: image.height, rgba })
  const positions = [12, 3, 1]
  const inputRows = Object.freeze(
    rows.map((row, index) => {
      const position = positions[index]
      const partyRegion = Object.freeze({ ...row.partyRegion })
      const equipmentScoreRegion = Object.freeze({ ...row.equipmentScoreRegion })

      return Object.freeze({ ...row, row: position, partyRegion, equipmentScoreRegion })
    })
  )
  const references = Object.freeze({
    parties: Object.freeze(
      templates.parties.map((template) => {
        const image = Object.freeze({ ...template.image })

        return Object.freeze({ ...template, image })
      })
    ),
    equipmentScoreGlyphs: Object.freeze(
      templates.equipmentScoreGlyphs.map((template) => {
        const image = Object.freeze({ ...template.image })

        return Object.freeze({ ...template, image })
      })
    )
  })
  const original = storage.slice()
  const referenceImages = [...references.parties, ...references.equipmentScoreGlyphs].map(
    ({ image }) => image
  )
  const originalReferences = referenceImages.map(({ rgba }) => rgba.slice())

  assert.deepEqual(readDNFRaidParticipantMetadata(view, inputRows, references), [
    { row: 12, party: 'G', equipmentScoreText: '1000.4K' },
    { row: 3, party: 'Y', equipmentScoreText: '0042' },
    { row: 1, party: null, equipmentScoreText: null }
  ])
  assert.deepEqual(
    inputRows.map(({ row }) => row),
    [12, 3, 1]
  )
  assert.deepEqual(storage, original)
  for (const [index, image] of referenceImages.entries()) {
    assert.deepEqual(image.rgba, originalReferences[index])
  }
  assert.deepEqual(readDNFRaidParticipantMetadata(view, [], references), [])
})

test(testTitles.regionBoundaries, () => {
  const image = frame(640, 600)
  const valid = {
    row: 12,
    occupied: false,
    partyRegion: { x: 448, y: 552, width: 192, height: 48 },
    equipmentScoreRegion: { x: 638, y: 598, width: 2, height: 2 }
  }

  assert.deepEqual(readDNFRaidParticipantMetadata(image, [valid], templates), [
    { row: 12, party: null, equipmentScoreText: null }
  ])
  for (const region of ['partyRegion', 'equipmentScoreRegion']) {
    for (const change of [
      { x: 449, y: 552, width: 192, height: 48 },
      { x: 448, y: 553, width: 192, height: 48 },
      { x: 0, y: 0, width: 193, height: 17 },
      { x: 0, y: 0, width: 42, height: 49 },
      { x: 0, y: 0, width: 0, height: 17 },
      { x: 0, y: 0, width: 42, height: 0 }
    ]) {
      assert.throws(
        () => readDNFRaidParticipantMetadata(image, [{ ...valid, [region]: change }], templates),
        RangeError,
        region
      )
    }
    for (const field of ['x', 'y', 'width', 'height']) {
      for (const value of [
        -1,
        0.5,
        NaN,
        Infinity,
        -Infinity,
        Number.MAX_SAFE_INTEGER + 1,
        '1',
        null,
        undefined
      ]) {
        const invalid = { ...valid[region], [field]: value }
        assert.throws(
          () => readDNFRaidParticipantMetadata(image, [{ ...valid, [region]: invalid }], templates),
          RangeError,
          `${region}의 ${field}: ${String(value)}`
        )
      }
    }
  }
  for (const row of [0, -1, 13, 1.5, NaN, Infinity, '1', null, undefined]) {
    assert.throws(
      () => readDNFRaidParticipantMetadata(image, [{ ...valid, row }], templates),
      RangeError,
      `행 번호 ${String(row)}`
    )
  }
  for (const occupied of [0, 1, 'false', null, undefined]) {
    assert.throws(
      () => readDNFRaidParticipantMetadata(image, [{ ...valid, occupied }], templates),
      RangeError
    )
  }
  assert.throws(() => readDNFRaidParticipantMetadata(image, Array(1), templates), RangeError)
})

test(testTitles.referenceSetLimits, () => {
  const { image, rows } = fixture([{ party: 'R', text: '1' }])
  const party = templates.parties.find(({ party }) => party === 'R')
  const glyph = templates.equipmentScoreGlyphs.find(({ character }) => character === '1')
  const bounded = {
    parties: Array(8).fill(party),
    equipmentScoreGlyphs: Array(26).fill(glyph)
  }

  assert.deepEqual(readDNFRaidParticipantMetadata(image, rows, bounded), [
    { row: 1, party: 'R', equipmentScoreText: '1' }
  ])
  for (const invalid of [
    { ...bounded, parties: [...bounded.parties, party] },
    { ...bounded, equipmentScoreGlyphs: [...bounded.equipmentScoreGlyphs, glyph] }
  ]) {
    assert.throws(() => readDNFRaidParticipantMetadata(image, rows, invalid), RangeError)
  }
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyDNFRaidValueColumn, parseDNFRaidValueNotation } from '@dfragon/lib'

const testTitles = {
  kinds: '수치 열 제목을 명성, 장비 점수 기준과 비교해 열 종류를 고른다',
  scaled: '확대된 열 제목도 기준 크기로 맞춰 비교한다',
  unknown: '두 기준 어느 쪽과도 확실히 가깝지 않으면 unknown을 반환한다',
  validation: '기준 크기, 대비, 영역 경계를 검사하고 원본을 바꾸지 않는다',
  notation: '쉼표와 K 표기를 표시될 수 있는 정수 범위로 바꾼다',
  invalidNotation: '형식이 다른 표기는 추측 없이 null을 반환한다'
}

function frame(width, height, color = [12, 16, 20, 255]) {
  const rgba = new Uint8ClampedArray(width * height * 4)
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

function headingCell(strokes) {
  const image = frame(75, 18, [40, 36, 28, 255])
  paint(image, 0, 0, 75, 1, [70, 64, 48, 255])
  paint(image, 0, 17, 75, 1, [20, 18, 14, 255])
  paint(image, 63, 6, 8, 2, [200, 160, 110, 255])
  paint(image, 63, 10, 8, 2, [200, 160, 110, 255])
  for (const [x, y, width, height] of strokes) {
    paint(image, x, y, width, height, [200, 160, 110, 255])
  }

  return image
}

const fameStrokes = [
  [24, 3, 9, 3],
  [24, 3, 3, 12],
  [24, 12, 9, 3],
  [38, 3, 3, 12],
  [43, 7, 6, 3]
]
const equipmentScoreStrokes = [
  [6, 3, 11, 3],
  [10, 3, 3, 12],
  [20, 3, 3, 12],
  [28, 6, 9, 3],
  [28, 12, 9, 3],
  [44, 3, 3, 12],
  [50, 7, 9, 3]
]
const otherStrokes = [
  [4, 12, 30, 3],
  [40, 3, 3, 12],
  [48, 3, 10, 3]
]
const templates = {
  fame: headingCell(fameStrokes),
  equipmentScore: headingCell(equipmentScoreStrokes)
}

function place(cell, scale = 1) {
  const image = frame(640, 360)
  const region = {
    x: 100,
    y: 50,
    width: Math.round(75 * scale),
    height: Math.round(18 * scale)
  }
  for (let row = 0; row < region.height; row += 1) {
    for (let column = 0; column < region.width; column += 1) {
      const source = (Math.floor(row / scale) * 75 + Math.floor(column / scale)) * 4
      paint(image, region.x + column, region.y + row, 1, 1, cell.rgba.subarray(source, source + 4))
    }
  }

  return { image, region }
}

test(testTitles.kinds, () => {
  const fame = place(headingCell(fameStrokes))
  const equipmentScore = place(headingCell(equipmentScoreStrokes))

  assert.equal(classifyDNFRaidValueColumn(fame.image, fame.region, templates), 'fame')
  assert.equal(
    classifyDNFRaidValueColumn(equipmentScore.image, equipmentScore.region, templates),
    'equipment-score'
  )
})

test(testTitles.scaled, () => {
  // fixture는 최근접 보간으로 확대해, 확대와 축소를 거친 획이 크게 어긋나지 않는 배율을 쓴다.
  for (const scale of [1.25, 1.8]) {
    const fame = place(headingCell(fameStrokes), scale)
    const equipmentScore = place(headingCell(equipmentScoreStrokes), scale)

    assert.equal(
      classifyDNFRaidValueColumn(fame.image, fame.region, templates),
      'fame',
      `${scale}배`
    )
    assert.equal(
      classifyDNFRaidValueColumn(equipmentScore.image, equipmentScore.region, templates),
      'equipment-score',
      `${scale}배`
    )
  }
})

test(testTitles.unknown, () => {
  const blank = place(headingCell([]))
  const flat = { image: frame(640, 360), region: { x: 100, y: 50, width: 75, height: 18 } }
  const other = place(headingCell(otherStrokes))

  assert.equal(classifyDNFRaidValueColumn(blank.image, blank.region, templates), 'unknown')
  assert.equal(classifyDNFRaidValueColumn(flat.image, flat.region, templates), 'unknown')
  assert.equal(classifyDNFRaidValueColumn(other.image, other.region, templates), 'unknown')
})

test(testTitles.validation, () => {
  const { image, region } = place(headingCell(fameStrokes))
  const original = image.rgba.slice()
  classifyDNFRaidValueColumn(image, region, templates)
  assert.deepEqual(image.rgba, original)

  for (const invalid of [
    { ...templates, fame: frame(74, 18) },
    { ...templates, equipmentScore: frame(75, 17) },
    { ...templates, fame: frame(75, 18) },
    null
  ]) {
    assert.throws(() => classifyDNFRaidValueColumn(image, region, invalid), RangeError)
  }

  for (const invalid of [
    { ...region, x: -1 },
    { ...region, x: 600 },
    { ...region, width: 0 },
    { ...region, width: 1.5 }
  ]) {
    assert.throws(() => classifyDNFRaidValueColumn(image, invalid, templates), RangeError)
  }
})

test(testTitles.notation, () => {
  const cases = [
    ['0', { min: 0, max: 0 }],
    ['2,212', { min: 2212, max: 2212 }],
    ['12,345', { min: 12345, max: 12345 }],
    ['548,612', { min: 548612, max: 548612 }],
    ['1,234,567', { min: 1234567, max: 1234567 }],
    ['1000.4K', { min: 1000400, max: 1000499 }],
    ['1,000.4K', { min: 1000400, max: 1000499 }],
    ['1000K', { min: 1000000, max: 1000999 }],
    ['1.23K', { min: 1230, max: 1239 }],
    ['1.234K', { min: 1234, max: 1234 }]
  ]
  for (const [text, expected] of cases) {
    assert.deepEqual(parseDNFRaidValueNotation(text), expected, text)
  }
})

test(testTitles.invalidNotation, () => {
  for (const text of [
    '',
    'K',
    '1.5',
    '12,34',
    '1,2345',
    ',123',
    '1..2K',
    '1.2345K',
    '1000.4k',
    ' 12,345',
    '12,345 ',
    '9007199254740993',
    '9007199254740.9K',
    '9007199254740K'
  ]) {
    assert.equal(parseDNFRaidValueNotation(text), null, text)
  }
})

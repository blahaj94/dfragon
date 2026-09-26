import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cropDNFRaidParticipantNicknames, detectDNFRaidParticipantWindow } from '@dfragon/lib'

// Artificial pixels only; game assets and participant information stay outside the repository.
function frame(width = 1067, height = 600) {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < rgba.length; index += 4) {
    rgba.set([12, 16, 20, 255], index)
  }
  return { width, height, rgba }
}

function paint(image, x, y, width, height, color) {
  for (let row = Math.max(0, y); row < Math.min(image.height, y + height); row += 1) {
    for (let column = Math.max(0, x); column < Math.min(image.width, x + width); column += 1) {
      image.rgba.set(color, (row * image.width + column) * 4)
    }
  }
}

function headingFixture() {
  const image = frame(423, 18)
  paint(image, 0, 0, 423, 1, [75, 70, 50, 255])
  paint(image, 0, 17, 423, 1, [60, 55, 40, 255])
  for (let column = 0; column < 5; column += 1) {
    paint(image, column * 84, 1, 1, 16, [65, 60, 40, 255])
    for (let glyph = 0; glyph < 6; glyph += 1) {
      const x = column * 84 + 10 + glyph * 9
      paint(image, x, 4, 2, 9, [190, 180, 150, 255])
      paint(image, x, 4 + ((column + glyph) % 3) * 3, 7, 2, [190, 180, 150, 255])
    }
  }
  return image
}

const heading = headingFixture()

function popup(image, { x = 200, y = 150, scale = 1, count = 12 } = {}) {
  const source = frame(465, 392)
  for (let row = 0; row < 18; row += 1) {
    const start = row * 423 * 4
    source.rgba.set(heading.rgba.subarray(start, start + 423 * 4), ((row + 68) * 465 + 15) * 4)
  }
  paint(source, 416, 54, 9, 9, [235, 20, 25, 255])
  for (let position = 0; position < 12; position += 1) {
    const row = 86 + position * 21
    if (position >= count) {
      paint(source, 68, row + 4, 12, 12, [35, 35, 35, 255])
      continue
    }
    paint(source, 66, row + 3, 15, 14, [175, 175, 185, 255])
    paint(source, 100, row + 5, 16, 10, [180, 175, 145, 255])
    paint(source, 284, row + 3, 10, 13, [25, 150, 220, 255])
    paint(source, 207, row + 5, 60, 10, [190, 175 + position, 140, 128])
  }
  // Nearest-neighbor rasterization differs from the detector's bilinear comparison.
  const left = Math.round(x - 15 * scale)
  const top = Math.round(y - 68 * scale)
  const width = Math.round(465 * scale)
  const height = Math.round(392 * scale)
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const sx = Math.min(464, Math.floor(column / scale))
      const sy = Math.min(391, Math.floor(row / scale))
      const offset = (sy * 465 + sx) * 4
      paint(image, left + column, top + row, 1, 1, source.rgba.subarray(offset, offset + 4))
    }
  }
}

test('finds twelve screen positions and copies independent, unmodified nickname RGBA', () => {
  const image = frame()
  popup(image)
  const original = image.rgba.slice()
  const result = cropDNFRaidParticipantNicknames(image, heading)

  assert.equal(result.status, 'found')
  assert.deepEqual(result.window, { x: 185, y: 82, width: 465, height: 392 })
  assert.equal(result.scale, 1)
  assert.ok(result.matchScore > 0.99)
  assert.deepEqual(
    result.rows.map((row) => row.row),
    Array.from({ length: 12 }, (_, i) => i + 1)
  )
  for (const [index, row] of result.rows.entries()) {
    assert.equal(row.occupied, true)
    assert.deepEqual(row.nickname, { x: 382, y: 171 + index * 21, width: 86, height: 17 })
    assert.deepEqual(row.partyRegion, { x: 203, y: 170 + index * 21, width: 42, height: 17 })
    assert.deepEqual(row.equipmentScoreRegion, {
      x: 306,
      y: 171 + index * 21,
      width: 75,
      height: 17
    })
    assert.equal(row.nicknameCrop.width, 86)
    assert.equal(row.nicknameCrop.height, 17)
    for (let y = 0; y < 17; y += 1) {
      const start = ((row.nickname.y + y) * image.width + row.nickname.x) * 4
      assert.deepEqual(
        [...row.nicknameCrop.rgba.subarray(y * 344, (y + 1) * 344)],
        [...original.subarray(start, start + 344)]
      )
    }
  }
  assert.deepEqual(image.rgba, original)
  assert.notEqual(result.rows[0].nicknameCrop.rgba.buffer, image.rgba.buffer)
  const second = result.rows[1].nicknameCrop.rgba.slice()
  result.rows[0].nicknameCrop.rgba.fill(0)
  assert.deepEqual(image.rgba, original)
  assert.deepEqual(result.rows[1].nicknameCrop.rgba, second)
})

test('keeps twelve positions when the raid shrinks and does not retain prior frame state', () => {
  const image = frame()
  popup(image, { count: 12 })
  assert.equal(
    cropDNFRaidParticipantNicknames(image, heading).rows.filter((row) => row.occupied).length,
    12
  )
  popup(image, { count: 7 })
  const result = cropDNFRaidParticipantNicknames(image, heading)

  assert.equal(result.status, 'found')
  assert.deepEqual(
    result.rows.filter((row) => row.occupied).map((row) => row.row),
    [1, 2, 3, 4, 5, 6, 7]
  )
  assert.equal(result.rows.length, 12)
  assert.ok(result.rows.slice(7).every((row) => !row.occupied && row.nicknameCrop === null))
})

test('finds an empty dialog and requires occupancy evidence outside the nickname column', () => {
  const image = frame()
  popup(image, { count: 0 })
  paint(image, 390, 173, 70, 11, [220, 190, 110, 255])
  paint(image, 251, 191, 15, 14, [200, 200, 200, 255])
  const result = cropDNFRaidParticipantNicknames(image, heading)

  assert.equal(result.status, 'found')
  assert.ok(result.rows.every((row) => !row.occupied && row.nicknameCrop === null))
})

for (const scale of [1.35, 1.8]) {
  test(`finds a translated ${scale}x twelve-row raster without receiving a UI setting`, () => {
    const image = frame(1920, 1080)
    popup(image, { x: 650, y: 250, scale, count: 10 })
    const result = cropDNFRaidParticipantNicknames(image, heading)

    assert.equal(result.status, 'found')
    assert.ok(Math.abs(result.scale - scale) < 0.01)
    assert.equal(result.rows.filter((row) => row.occupied).length, 10)
    assert.equal(result.rows.length, 12)
    for (const [index, row] of result.rows.entries()) {
      assert.ok(Math.abs(row.nickname.x - (650 + 182 * scale)) <= 2)
      assert.ok(Math.abs(row.nickname.y - (250 + (21 + 21 * index) * scale)) <= 2)
      assert.ok(Math.abs(row.nickname.width - 86 * scale) <= 2)
      assert.ok(Math.abs(row.nickname.height - 17 * scale) <= 2)
    }
  })
}

test('rejects a red marker without heading evidence and a heading without all twelve separators', () => {
  const image = frame()
  paint(image, 601, 136, 9, 9, [235, 20, 25, 255])
  assert.deepEqual(detectDNFRaidParticipantWindow(image, heading), { status: 'not-found' })
  popup(image)
  assert.equal(detectDNFRaidParticipantWindow(image, heading).status, 'found')
  // Erase a lower separator so validating only the first four rows would incorrectly pass.
  paint(image, 200, 354, 423, 7, [230, 230, 230, 255])
  assert.deepEqual(detectDNFRaidParticipantWindow(image, heading), { status: 'not-found' })
})

test('returns ambiguous instead of choosing between two complete raid dialogs', () => {
  const image = frame()
  popup(image, { x: 40, y: 100 })
  popup(image, { x: 580, y: 200 })
  assert.deepEqual(cropDNFRaidParticipantNicknames(image, heading), { status: 'ambiguous' })
})

test('accepts a full dialog at frame edges and rejects clipped or missing bottom rows', () => {
  const exact = frame()
  popup(exact, { x: 15, y: 68 })
  assert.equal(detectDNFRaidParticipantWindow(exact, heading).status, 'found')
  for (const placement of [
    { x: 14, y: 68 },
    { x: 200, y: 277 }
  ]) {
    const clipped = frame()
    popup(clipped, placement)
    assert.deepEqual(cropDNFRaidParticipantNicknames(clipped, heading), { status: 'not-found' })
  }
})

test('reports the candidate limit without returning an earlier valid dialog', () => {
  const image = frame(1920, 1080)
  popup(image)
  for (let index = 0; index < 129; index += 1) {
    paint(image, 800 + (index % 40) * 25, Math.floor(index / 40) * 25, 9, 9, [235, 20, 25, 255])
  }
  assert.deepEqual(cropDNFRaidParticipantNicknames(image, heading), { status: 'search-limit' })
})

test('ignores unrelated red decoration on a bright background', () => {
  const image = frame(1920, 1080)
  paint(image, 0, 0, image.width, image.height, [140, 160, 130, 255])
  popup(image, { x: 100, y: 100, count: 8 })
  for (let index = 0; index < 100; index += 1) {
    paint(
      image,
      900 + (index % 16) * 45,
      150 + Math.floor(index / 16) * 100,
      21,
      21,
      [235, 20, 25, 255]
    )
  }
  const result = cropDNFRaidParticipantNicknames(image, heading)
  assert.equal(result.status, 'found')
  assert.equal(result.rows.filter((row) => row.occupied).length, 8)
})

test('bounds input dimensions and validates raw bytes and the raid-specific heading size', () => {
  const image = frame()
  for (const invalid of [
    null,
    { ...image, width: 1066 },
    { ...image, width: 1921 },
    { ...image, height: 599 },
    { ...image, height: 1081 },
    { ...image, width: 1067.5 },
    { ...image, height: NaN },
    { ...image, rgba: image.rgba.subarray(4) },
    { ...image, rgba: new Uint16Array(image.rgba.length) }
  ]) {
    assert.throws(() => detectDNFRaidParticipantWindow(invalid, heading), RangeError)
  }
  for (const invalid of [null, frame(368, 17), frame(422, 18), frame(423, 17), frame(423, 18)]) {
    assert.throws(() => detectDNFRaidParticipantWindow(image, invalid), RangeError)
  }
})

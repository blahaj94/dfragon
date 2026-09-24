import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cropDNFPartyParticipantNicknames, detectDNFPartyParticipantWindow } from '@dfragon/lib'

// Artificial pixels only: no game assets, screenshots, or player names are distributed.
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
  const image = frame(368, 17)
  paint(image, 0, 0, 368, 1, [75, 70, 50, 255])
  paint(image, 0, 16, 368, 1, [60, 55, 40, 255])
  for (let column = 0; column < 4; column += 1) {
    paint(image, column * 92, 1, 1, 15, [65, 60, 40, 255])
    for (let glyph = 0; glyph < 6; glyph += 1) {
      const x = column * 92 + 18 + glyph * 9
      paint(image, x, 4, 2, 9, [190, 180, 150, 255])
      paint(image, x, 4 + ((column + glyph) % 3) * 3, 7, 2, [190, 180, 150, 255])
    }
  }
  return image
}

const heading = headingFixture()

function popup(image, { x = 200, y = 150, scale = 1, occupied = [1, 2, 3, 4] } = {}) {
  const source = frame(394, 210)
  for (let row = 0; row < 17; row += 1) {
    const start = row * 368 * 4
    source.rgba.set(heading.rgba.subarray(start, start + 368 * 4), ((row + 67) * 394 + 14) * 4)
  }
  paint(source, 370, 48, 9, 9, [235, 20, 25, 255])
  for (let slot = 1; slot <= 4; slot += 1) {
    const row = 84 + (slot - 1) * 22
    if (!occupied.includes(slot)) {
      // A conspicuous gold mark in the name column must remain an empty/locked slot.
      paint(source, 194, row + 5, 9, 10, [210, 175, 75, 255])
      continue
    }
    paint(source, 46, row + 3, 15, 14, [175, 175, 185, 255])
    paint(source, 67, row + 5, 13, 10, [180, 175, 145, 255])
    paint(source, 257, row + 3, 10, 13, [25, 150, 220, 255])
    paint(source, 178, row + 5, 60, 10, [190, 175 + slot, 140, 128])
  }
  // Nearest-neighbor rasterization is deliberately different from the detector's bilinear matcher.
  const left = Math.round(x - 14 * scale)
  const top = Math.round(y - 67 * scale)
  const width = Math.round(394 * scale)
  const height = Math.round(210 * scale)
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const sx = Math.min(393, Math.floor(column / scale))
      const sy = Math.min(209, Math.floor(row / scale))
      const offset = (sy * 394 + sx) * 4
      paint(image, left + column, top + row, 1, 1, source.rgba.subarray(offset, offset + 4))
    }
  }
}

test('locates a translated dialog with four occupied rows and independent raw RGBA crops', () => {
  const image = frame()
  popup(image)
  const original = image.rgba.slice()
  const result = cropDNFPartyParticipantNicknames(image, heading)
  assert.equal(result.status, 'found')
  assert.deepEqual(result.window, { x: 186, y: 83, width: 394, height: 210 })
  assert.equal(result.scale, 1)
  assert.ok(result.matchScore > 0.99)
  assert.deepEqual(
    result.rows.map((row) => row.slot),
    [1, 2, 3, 4]
  )
  for (const [index, row] of result.rows.entries()) {
    assert.equal(row.occupied, true)
    assert.deepEqual(row.nickname, { x: 354, y: 170 + index * 22, width: 84, height: 15 })
    assert.equal(row.crop.width, 84)
    assert.equal(row.crop.height, 15)
    for (let y = 0; y < 15; y += 1) {
      const start = ((row.nickname.y + y) * image.width + row.nickname.x) * 4
      assert.deepEqual(
        [...row.crop.rgba.subarray(y * 336, (y + 1) * 336)],
        [...original.subarray(start, start + 336)]
      )
    }
  }
  assert.deepEqual(image.rgba, original)
  assert.notEqual(result.rows[0].crop.rgba.buffer, image.rgba.buffer)
  const second = result.rows[1].crop.rgba.slice()
  result.rows[0].crop.rgba.fill(0)
  assert.deepEqual(image.rgba, original)
  assert.deepEqual(result.rows[1].crop.rgba, second)
})

test('keeps holes and ignores gold locks when only slot 3 remains', () => {
  const image = frame()
  popup(image, { x: 650, y: 330, occupied: [3] })
  const result = cropDNFPartyParticipantNicknames(image, heading)
  assert.equal(result.status, 'found')
  assert.deepEqual(
    result.rows.map((row) => [row.slot, row.occupied, row.crop !== null]),
    [
      [1, false, false],
      [2, false, false],
      [3, true, true],
      [4, false, false]
    ]
  )
  assert.deepEqual(result.rows[2].nickname, { x: 804, y: 394, width: 84, height: 15 })
})

test('returns a found but empty dialog and requires two independent occupancy signals', () => {
  const image = frame()
  popup(image, { occupied: [] })
  // A bright portrait alone must not create a participant.
  paint(image, 232, 170, 16, 16, [220, 220, 220, 255])
  const result = cropDNFPartyParticipantNicknames(image, heading)
  assert.equal(result.status, 'found')
  assert.ok(result.rows.every((row) => !row.occupied && row.crop === null))
})

test('finds a 1.8x raster on a full-HD frame without receiving the UI setting', () => {
  const image = frame(1920, 1080)
  popup(image, { x: 800, y: 350, scale: 1.8, occupied: [1, 4] })
  const result = detectDNFPartyParticipantWindow(image, heading)
  assert.equal(result.status, 'found')
  assert.ok(Math.abs(result.scale - 1.8) < 0.01)
  assert.deepEqual(
    result.rows.filter((row) => row.occupied).map((row) => row.slot),
    [1, 4]
  )
  const first = result.rows[0].nickname
  assert.ok(Math.abs(first.x - 1077) <= 2)
  assert.ok(Math.abs(first.y - 386) <= 2)
  assert.ok(Math.abs(first.width - 151) <= 2)
  assert.ok(Math.abs(first.height - 27) <= 1)
})

test('ignores unrelated red components and refuses a heading without the fixed row structure', () => {
  const image = frame()
  paint(image, 100, 200, 9, 9, [235, 20, 25, 255])
  assert.deepEqual(detectDNFPartyParticipantWindow(image, heading), { status: 'not-found' })
  popup(image)
  assert.equal(detectDNFPartyParticipantWindow(image, heading).status, 'found')
  paint(image, 200, 208, 368, 7, [230, 230, 230, 255])
  assert.deepEqual(detectDNFPartyParticipantWindow(image, heading), { status: 'not-found' })
})

test('does not choose arbitrarily when two complete dialogs match', () => {
  const image = frame()
  popup(image, { x: 100, y: 140 })
  popup(image, { x: 650, y: 350 })
  assert.deepEqual(cropDNFPartyParticipantNicknames(image, heading), { status: 'ambiguous' })
})

test('accepts exact frame edges but rejects a partially clipped dialog', () => {
  const image = frame()
  popup(image, { x: 14, y: 67 })
  assert.equal(detectDNFPartyParticipantWindow(image, heading).status, 'found')
  const clipped = frame()
  popup(clipped, { x: 13, y: 67 })
  assert.deepEqual(cropDNFPartyParticipantNicknames(clipped, heading), { status: 'not-found' })
})

test('reports the search limit without silently ignoring excess red candidates', () => {
  const image = frame()
  for (let index = 0; index < 129; index += 1) {
    paint(image, (index % 40) * 25, Math.floor(index / 40) * 25, 9, 9, [235, 20, 25, 255])
  }
  assert.deepEqual(cropDNFPartyParticipantNicknames(image, heading), { status: 'search-limit' })
})

test('bounds matching work for 128 large red candidates on a full-HD frame', () => {
  const image = frame(1920, 1080)
  for (let index = 0; index < 128; index += 1) {
    paint(
      image,
      900 + (index % 16) * 45,
      150 + Math.floor(index / 16) * 80,
      21,
      21,
      [235, 20, 25, 255]
    )
  }
  assert.deepEqual(detectDNFPartyParticipantWindow(image, heading), { status: 'search-limit' })
})

test('does not return a partial match when later candidates exhaust the matching budget', () => {
  const image = frame(1920, 1080)
  popup(image, { x: 200, y: 100 })
  for (let index = 0; index < 100; index += 1) {
    paint(
      image,
      900 + (index % 16) * 45,
      250 + Math.floor(index / 16) * 80,
      21,
      21,
      [235, 20, 25, 255]
    )
  }
  assert.equal(cropDNFPartyParticipantNicknames(image, heading).status, 'search-limit')
})

test('rejects invalid dimensions, byte layouts, and invalid heading templates', () => {
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
    assert.throws(() => detectDNFPartyParticipantWindow(invalid, heading), RangeError)
  }
  for (const invalid of [null, frame(367, 17), frame(368, 16), frame(368, 17)]) {
    assert.throws(() => detectDNFPartyParticipantWindow(image, invalid), RangeError)
  }
})

test('finds a dialog among unrelated red decorations on a bright game background', () => {
  const image = frame(1920, 1080)
  paint(image, 0, 0, image.width, image.height, [140, 160, 130, 255])
  popup(image, { x: 200, y: 100, occupied: [3] })
  for (let index = 0; index < 100; index += 1) {
    paint(
      image,
      900 + (index % 16) * 45,
      250 + Math.floor(index / 16) * 80,
      21,
      21,
      [235, 20, 25, 255]
    )
  }
  const result = cropDNFPartyParticipantNicknames(image, heading)
  assert.equal(result.status, 'found')
  assert.deepEqual(
    result.rows.filter((row) => row.occupied).map((row) => row.slot),
    [3]
  )
  assert.deepEqual(result.window, { x: 186, y: 33, width: 394, height: 210 })
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cropDNFPartyParticipantNicknames, detectDNFPartyParticipantWindow } from '@dfragon/lib'

const testTitles = {
  rawCrops: '이동한 창의 네 참가 행을 찾아 독립된 원본 RGBA 크롭을 반환한다',
  slotHoles: '3번 슬롯만 남아도 빈 행과 자물쇠를 유지하고 슬롯 번호를 당기지 않는다',
  emptyDialog: '빈 창도 검출하고 참가 판정에는 독립 근거 두 개 이상을 요구한다',
  scaledDialog: 'UI 설정 없이 FHD 화면의 1.8배 래스터를 찾는다',
  requiredRows: '무관한 빨간 영역과 네 행 구조가 없는 헤더를 제외한다',
  ambiguous: '완전한 창이 두 개 일치하면 임의 선택 없이 ambiguous를 반환한다',
  leftTopEdges: '왼쪽·위쪽 화면 경계는 허용하고 잘린 창은 거절한다',
  anchorLimit: '빨간 후보가 한도를 넘으면 일부를 제외하지 않고 search-limit을 반환한다',
  comparisonLimit: 'FHD의 큰 빨간 후보 128개에 대한 헤더 비교량을 제한한다',
  partialLimit: '뒤의 후보가 비교 예산을 소진하면 앞선 일치를 부분 성공으로 반환하지 않는다',
  validation: '크기와 RGBA 길이 및 헤더 대비를 각 공개 진입점에서 검사한다',
  brightDecorations: '밝은 배경의 무관한 빨간 장식 사이에서 완전한 합성 창을 찾는다',
  rightBottomEdges: '오른쪽·아래쪽 화면 경계에 정확히 닿는 창을 허용한다',
  clientLimits: '최소·최대 client 크기의 빈 화면은 각 공개 진입점에서 미검출로 반환한다',
  evidencePairs: '각 근거 쌍을 실측 열에서 읽고 닉네임만 밝은 네 번째 행은 비워 둔다',
  rgbaViews: '투명한 RGBA view도 검출하고 크롭 네 모서리의 채널과 alpha를 그대로 복사한다'
}

// 합성 픽셀만 사용하며 게임 자산·스크린샷·플레이어 이름은 포함하지 않는다.
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
      // 닉네임 열의 밝은 금색 표식만 있는 행은 빈 슬롯으로 남아야 한다.
      paint(source, 194, row + 5, 9, 10, [210, 175, 75, 255])
      continue
    }
    paint(source, 46, row + 3, 15, 14, [175, 175, 185, 255])
    paint(source, 67, row + 5, 13, 10, [180, 175, 145, 255])
    paint(source, 257, row + 3, 10, 13, [25, 150, 220, 255])
    paint(source, 178, row + 5, 60, 10, [190, 175 + slot, 140, 128])
  }
  // 합성 fixture는 검출기의 bilinear 보간과 다른 최근접 보간으로 그린다.
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

test(testTitles.rawCrops, () => {
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
    assert.deepEqual(row.nickname, {
      x: 354,
      y: [170, 192, 214, 236][index],
      width: 84,
      height: 15
    })
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

test(testTitles.slotHoles, () => {
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

test(testTitles.emptyDialog, () => {
  const image = frame()
  popup(image, { occupied: [] })
  // 밝은 초상화 하나만으로 참가자가 있다고 판정하지 않는다.
  paint(image, 232, 170, 16, 16, [220, 220, 220, 255])
  const result = cropDNFPartyParticipantNicknames(image, heading)
  assert.equal(result.status, 'found')
  assert.ok(result.rows.every((row) => !row.occupied && row.crop === null))
})

test(testTitles.scaledDialog, () => {
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

test(testTitles.requiredRows, () => {
  const image = frame()
  paint(image, 100, 200, 9, 9, [235, 20, 25, 255])
  assert.deepEqual(detectDNFPartyParticipantWindow(image, heading), { status: 'not-found' })
  popup(image)
  assert.equal(detectDNFPartyParticipantWindow(image, heading).status, 'found')
  paint(image, 200, 208, 368, 7, [230, 230, 230, 255])
  assert.deepEqual(detectDNFPartyParticipantWindow(image, heading), { status: 'not-found' })
})

test(testTitles.ambiguous, () => {
  const image = frame()
  popup(image, { x: 100, y: 140 })
  popup(image, { x: 650, y: 350 })
  assert.deepEqual(cropDNFPartyParticipantNicknames(image, heading), { status: 'ambiguous' })
})

test(testTitles.leftTopEdges, () => {
  const image = frame()
  popup(image, { x: 14, y: 67 })
  assert.equal(detectDNFPartyParticipantWindow(image, heading).status, 'found')
  const clipped = frame()
  popup(clipped, { x: 13, y: 67 })
  assert.deepEqual(cropDNFPartyParticipantNicknames(clipped, heading), { status: 'not-found' })
})

test(testTitles.anchorLimit, () => {
  const image = frame()
  for (let index = 0; index < 129; index += 1) {
    paint(image, (index % 40) * 25, Math.floor(index / 40) * 25, 9, 9, [235, 20, 25, 255])
  }
  assert.deepEqual(cropDNFPartyParticipantNicknames(image, heading), { status: 'search-limit' })
})

test(testTitles.comparisonLimit, () => {
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

test(testTitles.partialLimit, () => {
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

test(testTitles.validation, () => {
  const image = frame()
  const invalidFrames = [
    null,
    undefined,
    // 잘못된 크기에도 정확한 바이트 수를 준비해 길이 검사와 구별한다.
    ...[
      [1066, 600],
      [1921, 600],
      [1067, 599],
      [1067, 1081],
      [1067.5, 600],
      [1067, 600.5]
    ].map(([width, height]) => {
      const rgba = new Uint8Array(width * height * 4)

      return { width, height, rgba }
    }),
    { ...image, width: NaN },
    { ...image, width: Infinity },
    { ...image, height: -Infinity },
    { ...image, width: Number.MAX_SAFE_INTEGER + 1 },
    { ...image, width: '1067' },
    { ...image, height: null },
    { ...image, rgba: image.rgba.subarray(4) },
    { ...image, rgba: new Uint8Array(image.rgba.length + 4) },
    { ...image, rgba: new Uint16Array(image.rgba.length) },
    { ...image, rgba: new Int8Array(image.rgba.length) },
    { ...image, rgba: Array(image.rgba.length) }
  ]
  const flatHeading = frame(368, 17)
  for (let index = 3; index < flatHeading.rgba.length; index += 4) {
    flatHeading.rgba[index] = index % 256
  }
  const invalidHeadings = [
    null,
    undefined,
    frame(367, 17),
    frame(369, 17),
    frame(368, 16),
    frame(368, 18),
    flatHeading,
    { ...heading, width: '368' },
    { ...heading, rgba: heading.rgba.subarray(4) },
    { ...heading, rgba: new Uint8Array(heading.rgba.length + 4) },
    { ...heading, rgba: new Uint16Array(heading.rgba.length) },
    { ...heading, rgba: Array(heading.rgba.length) }
  ]
  for (const detectOrCrop of [detectDNFPartyParticipantWindow, cropDNFPartyParticipantNicknames]) {
    for (const invalid of invalidFrames) {
      assert.throws(() => detectOrCrop(invalid, heading), RangeError, detectOrCrop.name)
    }
    for (const invalid of invalidHeadings) {
      assert.throws(() => detectOrCrop(image, invalid), RangeError, detectOrCrop.name)
    }
  }
})

test(testTitles.brightDecorations, () => {
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

test(testTitles.rightBottomEdges, () => {
  const exact = frame()
  popup(exact, { x: 687, y: 457 })
  const result = cropDNFPartyParticipantNicknames(exact, heading)

  assert.equal(result.status, 'found')
  assert.equal(result.window.x + result.window.width, exact.width)
  assert.equal(result.window.y + result.window.height, exact.height)
})

test(testTitles.clientLimits, () => {
  for (const [width, height] of [
    [1067, 600],
    [1920, 1080]
  ]) {
    const image = { width, height, rgba: new Uint8Array(width * height * 4) }
    assert.deepEqual(detectDNFPartyParticipantWindow(image, heading), { status: 'not-found' })
    assert.deepEqual(cropDNFPartyParticipantNicknames(image, heading), { status: 'not-found' })
  }
})

test(testTitles.evidencePairs, () => {
  const image = frame()
  popup(image, { occupied: [] })
  // 헤더 (200,150)에 문서의 기준 열을 더한 literal 영역이다.
  paint(image, 231, 169, 17, 16, [160, 160, 160, 0])
  paint(image, 251, 169, 21, 16, [160, 160, 160, 0])
  paint(image, 231, 191, 17, 16, [160, 160, 160, 0])
  paint(image, 442, 191, 12, 16, [20, 180, 80, 0])
  paint(image, 251, 213, 21, 16, [160, 160, 160, 0])
  paint(image, 442, 213, 12, 16, [20, 180, 80, 0])
  paint(image, 354, 236, 84, 15, [255, 255, 255, 0])
  const result = cropDNFPartyParticipantNicknames(image, heading)

  assert.equal(result.status, 'found')
  assert.deepEqual(
    result.rows.map(({ slot, occupied, crop }) => [slot, occupied, crop !== null]),
    [
      [1, true, true],
      [2, true, true],
      [3, true, true],
      [4, false, false]
    ]
  )
})

test(testTitles.rgbaViews, () => {
  const corners = [
    [17, 33, 65, 0],
    [19, 35, 67, 17],
    [21, 37, 69, 128],
    [23, 39, 71, 255]
  ]
  for (const ArrayType of [Uint8Array, Uint8ClampedArray]) {
    const image = frame()
    popup(image, { occupied: [1, 4] })
    const storage = new ArrayType(image.rgba.length + 8).fill(211)
    storage.set(image.rgba, 4)
    const rgba = storage.subarray(4, storage.length - 4)
    for (let index = 3; index < rgba.length; index += 4) {
      rgba[index] = 0
    }
    const view = Object.freeze({ width: image.width, height: image.height, rgba })
    const headingStorage = new ArrayType(heading.rgba.length + 8).fill(73)
    headingStorage.set(heading.rgba, 4)
    const headingRgba = headingStorage.subarray(4, headingStorage.length - 4)
    for (let index = 3; index < headingRgba.length; index += 4) {
      headingRgba[index] = 0
    }
    const reference = Object.freeze({ width: 368, height: 17, rgba: headingRgba })
    for (const [index, [x, y]] of [
      [354, 170],
      [437, 170],
      [354, 184],
      [437, 184]
    ].entries()) {
      paint(view, x, y, 1, 1, corners[index])
    }
    const original = storage.slice()
    const originalHeading = headingStorage.slice()
    const result = cropDNFPartyParticipantNicknames(view, reference)

    assert.equal(result.status, 'found')
    assert.equal(result.scale, 1)
    assert.deepEqual(result.window, { x: 186, y: 83, width: 394, height: 210 })
    assert.deepEqual(
      result.rows.map(({ slot, occupied }) => [slot, occupied]),
      [
        [1, true],
        [2, false],
        [3, false],
        [4, true]
      ]
    )
    assert.deepEqual(result.rows[0].nickname, { x: 354, y: 170, width: 84, height: 15 })
    assert.equal(result.rows[1].crop, null)
    assert.equal(result.rows[2].crop, null)
    const crop = result.rows[0].crop
    assert.equal(crop.width, 84)
    assert.equal(crop.height, 15)
    assert.equal(crop.rgba.length, 5040)
    for (const [index, offset] of [0, 332, 4704, 5036].entries()) {
      assert.deepEqual([...crop.rgba.subarray(offset, offset + 4)], corners[index])
    }
    assert.notEqual(crop.rgba.buffer, storage.buffer)
    assert.notEqual(crop.rgba.buffer, result.rows[3].crop.rgba.buffer)
    assert.deepEqual(storage, original)
    assert.deepEqual(headingStorage, originalHeading)
    const fourthCrop = result.rows[3].crop.rgba.slice()
    rgba.fill(0)
    assert.deepEqual(result.rows[3].crop.rgba, fourthCrop)
    for (const [index, offset] of [0, 332, 4704, 5036].entries()) {
      assert.deepEqual([...crop.rgba.subarray(offset, offset + 4)], corners[index])
    }
  }
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cropDNFRaidParticipantNicknames, detectDNFRaidParticipantWindow } from '@dfragon/lib'

const testTitles = {
  rawCrops: '12개 화면 행을 찾아 닉네임 원본 RGBA를 독립 크롭으로 복사한다',
  shrinkingRaid: '공대 인원이 줄어도 12행을 유지하며 이전 프레임 상태를 재사용하지 않는다',
  emptyDialog: '빈 창도 검출하며 닉네임 열 밖의 근거로 참가 여부를 판단한다',
  scaledDialog: 'UI 설정 없이 이동·확대한 12행 래스터를 찾는다',
  requiredRows: '헤더가 없는 빨간 표식과 12개 구분선이 없는 창을 제외한다',
  ambiguous: '완전한 공대창이 두 개면 임의 선택 없이 ambiguous를 반환한다',
  clippedEdges: '화면 경계의 완전한 창은 허용하고 잘리거나 아래 행이 없는 창은 제외한다',
  anchorLimit: '후보 한도를 넘으면 앞선 유효한 창도 성공으로 반환하지 않는다',
  brightDecorations: '밝은 배경의 무관한 빨간 장식을 제외한다',
  validation: '각 공대 검출 진입점에서 정수 client 크기·RGBA 길이·공대 헤더를 검사한다',
  comparisonLimit: '뒤의 앵커가 공통 비교 예산을 소진하면 앞선 공대 일치도 반환하지 않는다',
  rightBottomEdges: '오른쪽·아래쪽 화면 경계에 정확히 닿는 공대창을 허용한다',
  clientLimits: '공대 검출은 다양한 client 크기의 빈 화면에서 미검출을 반환한다',
  evidencePairs: '공대 고유 열에서 참가 근거 세 쌍을 읽고 닉네임 픽셀만 있는 행은 제외한다',
  rgbaViews: '공대의 투명한 RGBA view에서 네 모서리 원본 픽셀과 독립 크롭을 보존한다'
}

// 합성 픽셀만 사용하며 게임 자산·참가자 정보는 포함하지 않는다.
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
  // 합성 fixture는 검출기의 bilinear 비교와 다른 최근접 보간으로 그린다.
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

test(testTitles.rawCrops, () => {
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
    assert.deepEqual(row.nickname, {
      x: 382,
      y: [171, 192, 213, 234, 255, 276, 297, 318, 339, 360, 381, 402][index],
      width: 86,
      height: 17
    })
    assert.deepEqual(row.partyRegion, {
      x: 203,
      y: [170, 191, 212, 233, 254, 275, 296, 317, 338, 359, 380, 401][index],
      width: 42,
      height: 17
    })
    assert.deepEqual(row.equipmentScoreRegion, {
      x: 306,
      y: [171, 192, 213, 234, 255, 276, 297, 318, 339, 360, 381, 402][index],
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

test(testTitles.shrinkingRaid, () => {
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

test(testTitles.emptyDialog, () => {
  const image = frame()
  popup(image, { count: 0 })
  paint(image, 390, 173, 70, 11, [220, 190, 110, 255])
  paint(image, 251, 191, 15, 14, [200, 200, 200, 255])
  const result = cropDNFRaidParticipantNicknames(image, heading)

  assert.equal(result.status, 'found')
  assert.ok(result.rows.every((row) => !row.occupied && row.nicknameCrop === null))
})

// desktop-raid-participants.md의 기준 열·12행을 손으로 확대·이동한 연속 좌표다.
// 합성 최근접 보간과 검출기 보간의 차이에 대한 기존 2px 허용 범위는 유지한다.
const scaledNicknameCases = [
  {
    scale: 1.35,
    x: 895.7,
    width: 116.1,
    height: 22.95,
    tops: [278.35, 306.7, 335.05, 363.4, 391.75, 420.1, 448.45, 476.8, 505.15, 533.5, 561.85, 590.2]
  },
  {
    scale: 1.8,
    x: 977.6,
    width: 154.8,
    height: 30.6,
    tops: [287.8, 325.6, 363.4, 401.2, 439, 476.8, 514.6, 552.4, 590.2, 628, 665.8, 703.6]
  }
]
for (const expected of scaledNicknameCases) {
  test(`${testTitles.scaledDialog} (${expected.scale}배)`, () => {
    const image = frame(1920, 1080)
    popup(image, { x: 650, y: 250, scale: expected.scale, count: 10 })
    const result = cropDNFRaidParticipantNicknames(image, heading)

    assert.equal(result.status, 'found')
    assert.ok(Math.abs(result.scale - expected.scale) < 0.01)
    assert.deepEqual(
      result.rows.filter((row) => row.occupied).map((row) => row.row),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    )
    assert.equal(result.rows.length, 12)
    for (const [index, row] of result.rows.entries()) {
      assert.ok(Math.abs(row.nickname.x - expected.x) <= 2, `${row.row}행의 x`)
      assert.ok(Math.abs(row.nickname.y - expected.tops[index]) <= 2, `${row.row}행의 y`)
      assert.ok(Math.abs(row.nickname.width - expected.width) <= 2, `${row.row}행의 폭`)
      assert.ok(Math.abs(row.nickname.height - expected.height) <= 2, `${row.row}행의 높이`)
    }
  })
}

test(testTitles.requiredRows, () => {
  const image = frame()
  paint(image, 601, 136, 9, 9, [235, 20, 25, 255])
  assert.deepEqual(detectDNFRaidParticipantWindow(image, heading), { status: 'not-found' })
  popup(image)
  assert.equal(detectDNFRaidParticipantWindow(image, heading).status, 'found')
  // 아래 구분선을 지워 앞의 네 행만 검사하는 잘못된 검출을 구별한다.
  paint(image, 200, 354, 423, 7, [230, 230, 230, 255])
  assert.deepEqual(detectDNFRaidParticipantWindow(image, heading), { status: 'not-found' })
})

test(testTitles.ambiguous, () => {
  const image = frame()
  popup(image, { x: 40, y: 100 })
  popup(image, { x: 580, y: 200 })
  assert.deepEqual(cropDNFRaidParticipantNicknames(image, heading), { status: 'ambiguous' })
})

test(testTitles.clippedEdges, () => {
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

test(testTitles.anchorLimit, () => {
  const image = frame(1920, 1080)
  popup(image)
  for (let index = 0; index < 129; index += 1) {
    paint(image, 800 + (index % 40) * 25, Math.floor(index / 40) * 25, 9, 9, [235, 20, 25, 255])
  }
  assert.deepEqual(cropDNFRaidParticipantNicknames(image, heading), { status: 'search-limit' })
})

test(testTitles.brightDecorations, () => {
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

test(testTitles.validation, () => {
  const image = frame()
  const invalidFrames = [
    null,
    undefined,
    // 크기 경계와 정수 검사를 잘못된 바이트 길이만으로 통과시키지 않는다.
    ...[
      [0, 600],
      [8193, 1],
      [1067, 0],
      [1, 8193],
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
    { ...image, width: 6000, height: 5501 },
    { ...image, width: '1067' },
    { ...image, height: null },
    { ...image, rgba: image.rgba.subarray(4) },
    { ...image, rgba: new Uint8Array(image.rgba.length + 4) },
    { ...image, rgba: new Uint16Array(image.rgba.length) },
    { ...image, rgba: new Int8Array(image.rgba.length) },
    { ...image, rgba: Array(image.rgba.length) }
  ]
  const flatHeading = frame(423, 18)
  for (let index = 3; index < flatHeading.rgba.length; index += 4) {
    flatHeading.rgba[index] = index % 256
  }
  const invalidHeadings = [
    null,
    undefined,
    frame(368, 17),
    frame(422, 18),
    frame(424, 18),
    frame(423, 17),
    frame(423, 19),
    flatHeading,
    { ...heading, width: '423' },
    { ...heading, rgba: heading.rgba.subarray(4) },
    { ...heading, rgba: new Uint8Array(heading.rgba.length + 4) },
    { ...heading, rgba: new Uint16Array(heading.rgba.length) },
    { ...heading, rgba: Array(heading.rgba.length) }
  ]
  for (const detectOrCrop of [detectDNFRaidParticipantWindow, cropDNFRaidParticipantNicknames]) {
    for (const invalid of invalidFrames) {
      assert.throws(() => detectOrCrop(invalid, heading), RangeError, detectOrCrop.name)
    }
    for (const invalid of invalidHeadings) {
      assert.throws(() => detectOrCrop(image, invalid), RangeError, detectOrCrop.name)
    }
  }
})

test(testTitles.comparisonLimit, () => {
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

  assert.equal(cropDNFRaidParticipantNicknames(image, heading).status, 'search-limit')
})

test(testTitles.rightBottomEdges, () => {
  const exact = frame()
  popup(exact, { x: 617, y: 276 })
  const result = cropDNFRaidParticipantNicknames(exact, heading)

  assert.equal(result.status, 'found')
  assert.equal(result.window.x + result.window.width, exact.width)
  assert.equal(result.window.y + result.window.height, exact.height)
})

test(testTitles.clientLimits, () => {
  for (const [width, height] of [
    [800, 450],
    [1067, 600],
    [1920, 1080],
    [3840, 2160]
  ]) {
    const image = { width, height, rgba: new Uint8Array(width * height * 4) }
    assert.deepEqual(detectDNFRaidParticipantWindow(image, heading), { status: 'not-found' })
    assert.deepEqual(cropDNFRaidParticipantNicknames(image, heading), { status: 'not-found' })
  }
})

test('4K 화면의 FHD 범위 바깥에 있는 공대원창을 원본 좌표로 크롭한다', () => {
  const image = frame(3840, 2160)
  popup(image, { x: 2900, y: 1600, count: 2 })

  const result = cropDNFRaidParticipantNicknames(image, heading)

  assert.equal(result.status, 'found')
  assert.deepEqual(result.window, { x: 2885, y: 1532, width: 465, height: 392 })
  assert.deepEqual(
    result.rows.filter(({ occupied }) => occupied).map(({ row }) => row),
    [1, 2]
  )
  assert.deepEqual(result.rows[0].nickname, { x: 3082, y: 1621, width: 86, height: 17 })
})

test(testTitles.evidencePairs, () => {
  const image = frame()
  popup(image, { count: 0 })
  paint(image, 251, 170, 15, 16, [160, 160, 160, 0])
  paint(image, 285, 170, 19, 16, [160, 160, 160, 0])
  paint(image, 251, 191, 15, 16, [160, 160, 160, 0])
  paint(image, 469, 191, 12, 16, [20, 180, 80, 0])
  paint(image, 285, 212, 19, 16, [160, 160, 160, 0])
  paint(image, 469, 212, 12, 16, [20, 180, 80, 0])
  paint(image, 382, 234, 86, 17, [255, 255, 255, 0])
  const result = cropDNFRaidParticipantNicknames(image, heading)

  assert.equal(result.status, 'found')
  assert.deepEqual(
    result.rows.filter(({ occupied }) => occupied).map(({ row }) => row),
    [1, 2, 3]
  )
  assert.deepEqual(
    result.rows.filter(({ nicknameCrop }) => nicknameCrop !== null).map(({ row }) => row),
    [1, 2, 3]
  )
  assert.deepEqual(
    result.rows.map(({ row }) => row),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
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
    popup(image, { count: 2 })
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
    const reference = Object.freeze({ width: 423, height: 18, rgba: headingRgba })
    for (const [index, [x, y]] of [
      [382, 171],
      [467, 171],
      [382, 187],
      [467, 187]
    ].entries()) {
      paint(view, x, y, 1, 1, corners[index])
    }
    const original = storage.slice()
    const originalHeading = headingStorage.slice()
    const result = cropDNFRaidParticipantNicknames(view, reference)

    assert.equal(result.status, 'found')
    assert.equal(result.scale, 1)
    assert.deepEqual(result.window, { x: 185, y: 82, width: 465, height: 392 })
    assert.deepEqual(
      result.rows.filter(({ occupied }) => occupied).map(({ row }) => row),
      [1, 2]
    )
    assert.ok(result.rows.slice(2).every(({ nicknameCrop }) => nicknameCrop === null))
    assert.deepEqual(result.rows[0].nickname, { x: 382, y: 171, width: 86, height: 17 })
    const crop = result.rows[0].nicknameCrop
    assert.equal(crop.width, 86)
    assert.equal(crop.height, 17)
    assert.equal(crop.rgba.length, 5848)
    for (const [index, offset] of [0, 340, 5504, 5844].entries()) {
      assert.deepEqual([...crop.rgba.subarray(offset, offset + 4)], corners[index])
    }
    assert.notEqual(crop.rgba.buffer, storage.buffer)
    assert.notEqual(crop.rgba.buffer, result.rows[1].nicknameCrop.rgba.buffer)
    assert.deepEqual(storage, original)
    assert.deepEqual(headingStorage, originalHeading)
    const secondCrop = result.rows[1].nicknameCrop.rgba.slice()
    rgba.fill(0)
    assert.deepEqual(result.rows[1].nicknameCrop.rgba, secondCrop)
    for (const [index, offset] of [0, 340, 5504, 5844].entries()) {
      assert.deepEqual([...crop.rgba.subarray(offset, offset + 4)], corners[index])
    }
  }
})

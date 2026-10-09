import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estimateDNFPartyScale, estimateDNFUIScale, projectDNFPartyRegions } from '@dfragon/lib'

// 호출자 보정용 합성 좌표이며 검증된 닉네임 경계가 아니다.
const baseRegion = Object.freeze({ x: 40, y: 10, width: 80, height: 14 })
const clientSize = Object.freeze({ width: 1067, height: 600 })
const options = Object.freeze({ baseRegion, clientSize, scale: 1 })

test('인접 앵커의 관측 간격에서 UI 설정 없이 배율을 추정한다', () => {
  assert.equal(estimateDNFPartyScale(141), 1)
  const scale = estimateDNFPartyScale(181)
  // 두 사람의 관측 간격은 정수 픽셀 측정값이므로 UI 모델 배율과 정확히 같지 않다.
  assert.equal(scale, 1.2836879432624113)
  assert.ok(Math.abs(scale - 1.2857142857142858) < 0.003)
  assert.equal(estimateDNFPartyScale(282), 2)
  assert.equal(estimateDNFPartyScale(70.5), 0.5)
  assert.equal(estimateDNFPartyScale(141 * Number.MIN_VALUE), Number.MIN_VALUE)
})

test('잘못되거나 역방향이거나 양수 배율로 표현할 수 없는 간격을 거절한다', () => {
  for (const spacing of [0, -141, NaN, Infinity, -Infinity, Number.MIN_VALUE, '141', null]) {
    assert.throws(() => estimateDNFPartyScale(spacing), RangeError)
  }
})

test('관측한 141px 기준 간격으로 네 후보를 투영한다', () => {
  assert.deepEqual(projectDNFPartyRegions(options), [
    { x: 40, y: 10, width: 80, height: 14 },
    { x: 181, y: 10, width: 80, height: 14 },
    { x: 322, y: 10, width: 80, height: 14 },
    { x: 463, y: 10, width: 80, height: 14 }
  ])
})

test('반올림한 간격을 누적하지 않고 각 슬롯의 기준 좌표를 투영한다', () => {
  const regions = projectDNFPartyRegions({
    ...options,
    clientSize: { width: 1920, height: 1080 },
    scale: estimateDNFUIScale(50)
  })
  assert.deepEqual(regions, [
    { x: 51, y: 12, width: 104, height: 19 },
    { x: 232, y: 12, width: 104, height: 19 },
    { x: 414, y: 12, width: 103, height: 19 },
    { x: 595, y: 12, width: 104, height: 19 }
  ])
})

test('실측 기준 영역을 확대하면 관측한 두 HP 색 띠를 포함한다', () => {
  const regions = projectDNFPartyRegions({
    clientSize: { width: 1920, height: 1080 },
    baseRegion: { x: 42, y: 27, width: 99, height: 3 },
    scale: estimateDNFPartyScale(181)
  })
  // 독립적으로 관측한 숫자이며 이미지 fixture나 닉네임 보정값이 아니다.
  for (const [index, x] of [55, 236].entries()) {
    const region = regions[index]
    assert.ok(region.x <= x && region.x + region.width >= x + 126)
    assert.ok(region.y <= 35 && region.y + region.height >= 38)
  }
})

test('출력 픽셀 이동량을 더한 뒤 모든 모서리를 바깥쪽으로 반올림한다', () => {
  const regions = projectDNFPartyRegions({
    ...options,
    scale: 1.25,
    offset: { x: 10.25, y: 5.5 }
  })
  assert.deepEqual(regions, [
    { x: 60, y: 18, width: 101, height: 18 },
    { x: 236, y: 18, width: 101, height: 18 },
    { x: 412, y: 18, width: 101, height: 18 },
    { x: 589, y: 18, width: 100, height: 18 }
  ])
  assert.equal(projectDNFPartyRegions({ ...options, offset: { x: -40, y: -10 } })[0].x, 0)
})

test('정확한 client 경계는 허용하고 잘린 후보는 전체 호출을 거절한다', () => {
  assert.equal(
    projectDNFPartyRegions({ ...options, clientSize: { width: 543, height: 24 } }).length,
    4
  )
  for (const change of [
    { clientSize: { width: 542, height: 600 } },
    { clientSize: { width: 1067, height: 23 } },
    { offset: { x: -40.1, y: 0 } },
    { offset: { x: 0, y: -10.1 } }
  ]) {
    assert.throws(() => projectDNFPartyRegions({ ...options, ...change }), RangeError)
  }
})

test('잘못된 geometry와 숫자 overflow는 좌표 반환 전에 거절한다', () => {
  for (const change of [
    { scale: 0 },
    { scale: -1 },
    { scale: NaN },
    { scale: Infinity },
    { scale: Number.MAX_VALUE },
    { clientSize: { width: 1067.5, height: 600 } },
    { clientSize: { width: 0, height: 600 } },
    { clientSize: { width: 1067, height: Infinity } },
    { baseRegion: { ...baseRegion, x: -1 } },
    { baseRegion: { ...baseRegion, y: NaN } },
    { baseRegion: { ...baseRegion, width: 0 } },
    { baseRegion: { ...baseRegion, height: -1 } },
    { offset: { x: Infinity, y: 0 } }
  ]) {
    assert.throws(() => projectDNFPartyRegions({ ...options, ...change }), RangeError)
  }
})

test('독립 사각형을 반환하고 호출자의 보정값을 유지한다', () => {
  const regions = projectDNFPartyRegions(options)
  regions[0].x = 999
  assert.equal(baseRegion.x, 40)
  assert.equal(regions[1].x, 181)
  assert.equal(projectDNFPartyRegions(options)[0].x, 40)
})

test('작은 양수 소수 영역을 잃지 않고 각 슬롯 모서리를 바깥쪽으로 감싼다', () => {
  // 첫 모서리는 (0.5, 0.5), 다음 가로 모서리는 71, 141.5, 212다.
  const input = Object.freeze({
    clientSize: Object.freeze({ width: 213, height: 1 }),
    baseRegion: Object.freeze({ x: 0.5, y: 0.5, width: 1, height: 1 }),
    scale: 0.5,
    offset: Object.freeze({ x: 0.25, y: 0.25 })
  })

  assert.deepEqual(projectDNFPartyRegions(input), [
    { x: 0, y: 0, width: 1, height: 1 },
    { x: 71, y: 0, width: 1, height: 1 },
    { x: 141, y: 0, width: 1, height: 1 },
    { x: 212, y: 0, width: 1, height: 1 }
  ])
  assert.deepEqual(input.offset, { x: 0.25, y: 0.25 })
  assert.deepEqual(input.baseRegion, { x: 0.5, y: 0.5, width: 1, height: 1 })
})

test('각 숫자 필드의 유한 값, 정수, 양수 계약을 별도로 검사한다', () => {
  for (const value of [NaN, Infinity, -Infinity, '1', null, undefined]) {
    for (const field of ['x', 'y', 'width', 'height']) {
      assert.throws(
        () => projectDNFPartyRegions({ ...options, baseRegion: { ...baseRegion, [field]: value } }),
        RangeError,
        `기준 영역 ${field}: ${String(value)}`
      )
    }
    for (const field of ['x', 'y']) {
      assert.throws(
        () => projectDNFPartyRegions({ ...options, offset: { x: 0, y: 0, [field]: value } }),
        RangeError,
        `출력 이동량 ${field}: ${String(value)}`
      )
    }
    assert.throws(() => projectDNFPartyRegions({ ...options, scale: value }), RangeError)
  }
  for (const value of [
    0,
    -1,
    0.5,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '600',
    null
  ]) {
    for (const field of ['width', 'height']) {
      assert.throws(
        () => projectDNFPartyRegions({ ...options, clientSize: { ...clientSize, [field]: value } }),
        RangeError,
        `client 크기 ${field}: ${String(value)}`
      )
    }
  }
  for (const field of ['x', 'y']) {
    assert.throws(
      () => projectDNFPartyRegions({ ...options, baseRegion: { ...baseRegion, [field]: -0.01 } }),
      RangeError
    )
  }
  for (const field of ['width', 'height']) {
    for (const value of [0, -0.01]) {
      assert.throws(
        () => projectDNFPartyRegions({ ...options, baseRegion: { ...baseRegion, [field]: value } }),
        RangeError
      )
    }
  }
  assert.throws(
    () =>
      projectDNFPartyRegions({
        ...options,
        scale: Number.MIN_VALUE,
        baseRegion: { x: 0, y: 0, width: Number.MIN_VALUE, height: 1 }
      }),
    RangeError
  )
  assert.throws(
    () =>
      projectDNFPartyRegions({ ...options, baseRegion: { ...baseRegion, x: Number.MAX_VALUE } }),
    RangeError
  )
})

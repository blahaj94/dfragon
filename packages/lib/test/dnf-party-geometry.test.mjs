import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estimateDNFPartyScale, estimateDNFUIScale, projectDNFPartyRegions } from '@dfragon/lib'

// Synthetic caller calibration; these are not verified nickname bounds.
const baseRegion = Object.freeze({ x: 40, y: 10, width: 80, height: 14 })
const clientSize = Object.freeze({ width: 1067, height: 600 })
const options = Object.freeze({ baseRegion, clientSize, scale: 1 })

test('derives scale from adjacent observed anchors without a UI setting', () => {
  assert.equal(estimateDNFPartyScale(141), 1)
  const scale = estimateDNFPartyScale(181)
  // Two-person measured spacing has integer quantization, not exact model equality.
  assert.ok(Math.abs(scale - 1.2857142857142858) < 0.003)
})

test('rejects invalid, reversed, or unrepresentably small anchor spacing', () => {
  for (const spacing of [0, -141, NaN, Infinity, -Infinity, Number.MIN_VALUE, '141', null]) {
    assert.throws(() => estimateDNFPartyScale(spacing), RangeError)
  }
})

test('projects four candidates using the 141px observed reference spacing', () => {
  assert.deepEqual(projectDNFPartyRegions(options), [
    { x: 40, y: 10, width: 80, height: 14 },
    { x: 181, y: 10, width: 80, height: 14 },
    { x: 322, y: 10, width: 80, height: 14 },
    { x: 463, y: 10, width: 80, height: 14 }
  ])
})

test('rounds every slot from reference coordinates instead of accumulating rounded spacing', () => {
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

test('contains the two observed full HP bars after scaling a measured reference region', () => {
  const regions = projectDNFPartyRegions({
    clientSize: { width: 1920, height: 1080 },
    baseRegion: { x: 42, y: 27, width: 99, height: 3 },
    scale: estimateDNFPartyScale(181)
  })
  // Independent numeric observations, not image fixtures or nickname calibration.
  for (const [index, x] of [55, 236].entries()) {
    const region = regions[index]
    assert.ok(region.x <= x && region.x + region.width >= x + 126)
    assert.ok(region.y <= 35 && region.y + region.height >= 38)
  }
})

test('applies translation in output pixels and rounds both rectangle edges outward', () => {
  const regions = projectDNFPartyRegions({
    ...options,
    scale: 1.25,
    offset: { x: 10.25, y: 5.5 }
  })
  assert.deepEqual(regions[0], { x: 60, y: 18, width: 101, height: 18 })
  assert.equal(projectDNFPartyRegions({ ...options, offset: { x: -40, y: -10 } })[0].x, 0)
})

test('accepts exact client boundaries and rejects partial candidates without clipping', () => {
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

test('rejects invalid geometry and numeric overflow before returning crop coordinates', () => {
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

test('returns independent rectangles and leaves caller calibration unchanged', () => {
  const regions = projectDNFPartyRegions(options)
  regions[0].x = 999
  assert.equal(baseRegion.x, 40)
  assert.equal(regions[1].x, 181)
  assert.equal(projectDNFPartyRegions(options)[0].x, 40)
})

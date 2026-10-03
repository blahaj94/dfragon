import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  participantGrayscale,
  participantRefinementScales,
  roundParticipantPixel
} from '../dist/dnf-party-participant-matching.js'

test('배율 연산 오차가 있어도 반 픽셀 좌표를 짝수로 반올림한다', () => {
  const scale = 1.28 - 2 * 0.0025
  for (const [value, expected] of [
    [380 * scale, 484],
    [-380 * scale, -484],
    [1 + 380 * scale, 486],
    [-1 - 380 * scale, -486],
    [484.5, 484],
    [485.5, 486],
    [-484.5, -484],
    [-485.5, -486],
    [484.5 - 1e-8, 484],
    [484.5 + 1e-8, 485],
    [-484.5 - 1e-8, -485],
    [-484.5 + 1e-8, -484]
  ]) {
    assert.equal(roundParticipantPixel(value), expected, String(value))
  }
})

test('중심을 포함한 21개 정밀 배율과 0.0025 간격 및 반 픽셀 투영을 유지한다', () => {
  for (const center of [1, 1.275, 1.8]) {
    const scales = participantRefinementScales(center)

    assert.equal(scales.length, 21)
    assert.equal(scales[10], center)
    assert.equal(scales[0], center - 0.025)
    assert.equal(scales[20], center + 0.025)
    for (let index = 1; index < scales.length; index += 1) {
      assert.ok(Math.abs(scales[index] - scales[index - 1] - 0.0025) < 1e-15)
      assert.ok(Math.abs(scales[index] + scales[20 - index] - 2 * center) < 1e-15)
    }
  }
  const scales = participantRefinementScales(1.28)

  assert.equal(roundParticipantPixel(380 * scales[8]), 484)
  assert.equal(roundParticipantPixel(1 + 380 * scales[8]), 486)
})

test('기본 반 픽셀의 양수·음수 좌표를 짝수로 반올림한다', () => {
  for (const [value, expected] of [
    [0.5, 0],
    [1.5, 2],
    [2.5, 2],
    [3.5, 4],
    [-0.5, 0],
    [-1.5, -2],
    [-2.5, -2],
    [-3.5, -4]
  ]) {
    assert.equal(roundParticipantPixel(value), expected, `반 픽셀 ${value}`)
  }
})

test('RGBA view의 채널과 alpha를 유지하면서 독립 회색조 배열을 만든다', () => {
  const pixels = [
    [255, 0, 0, 0],
    [0, 255, 0, 17],
    [0, 0, 255, 128],
    [255, 255, 255, 255],
    [10, 20, 30, 0],
    [0, 0, 0, 255]
  ].flat()
  for (const ArrayType of [Uint8Array, Uint8ClampedArray]) {
    const storage = ArrayType.from([9, 8, 7, 6, ...pixels, 5, 4, 3, 2])
    const rgba = storage.subarray(4, storage.length - 4)
    const original = storage.slice()
    const gray = participantGrayscale(rgba)

    // 원색의 휘도는 76·150·29, (10,20,30)의 휘도는 18로 손으로 검산된다.
    assert.deepEqual([...gray], [76, 150, 29, 255, 18, 0])
    assert.deepEqual(storage, original)
    gray.fill(0)
    assert.deepEqual(storage, original)
  }
})

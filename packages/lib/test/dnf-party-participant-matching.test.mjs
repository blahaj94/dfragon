import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  participantRefinementScales,
  roundParticipantPixel
} from '../dist/dnf-party-participant-matching.js'

test('rounds projected half pixels to even despite scale arithmetic error', () => {
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

test('keeps 21 centered refinement scales with 0.0025 spacing and unchanged half-pixel projection', () => {
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

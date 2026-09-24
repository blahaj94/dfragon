import assert from 'node:assert/strict'
import { test } from 'node:test'
import { roundParticipantPixel } from '../dist/dnf-party-participant-matching.js'

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

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  hasParticipantEvidence,
  participantEvidenceRatio
} from '../dist/dnf-participant-evidence.js'

test('requires each pair of occupancy signals at their inclusive ratio boundaries', () => {
  const thresholds = { portrait: 0.12, level: 0.035, role: 0.1 }
  for (let mask = 0; mask < 8; mask += 1) {
    const evidence = {
      portrait: mask & 1 ? thresholds.portrait : thresholds.portrait - Number.EPSILON,
      level: mask & 2 ? thresholds.level : thresholds.level - Number.EPSILON,
      role: mask & 4 ? thresholds.role : thresholds.role - Number.EPSILON
    }
    const expected = [3, 5, 6, 7].includes(mask)

    assert.equal(hasParticipantEvidence(evidence), expected, `signal mask ${mask}`)
    for (const key of Object.keys(thresholds)) {
      if (evidence[key] === thresholds[key]) {
        assert.equal(
          hasParticipantEvidence({ ...evidence, [key]: thresholds[key] + Number.EPSILON }),
          expected,
          `${key} immediately above threshold in signal mask ${mask}`
        )
      }
    }
  }
})

test('preserves brightness and role-color boundaries, independent of channel order or alpha', () => {
  for (const [color, colored, expected] of [
    [[99, 20, 20, 255], false, 0],
    [[100, 20, 20, 0], false, 1],
    [[20, 101, 20, 128], false, 1],
    [[119, 59, 59, 255], true, 0],
    [[120, 61, 61, 255], true, 0],
    [[120, 60, 60, 0], true, 1],
    [[60, 121, 60, 128], true, 1],
    [[60, 60, 120, 255], true, 1],
    [[120, 120, 120, 255], true, 0]
  ]) {
    const rgba = Uint8Array.from([255, 255, 255, 255, ...color, 255, 255, 255, 255])
    const original = rgba.slice()
    const frame = { width: 3, height: 1, rgba }
    const region = { x: 1, y: 0, width: 1, height: 1 }

    assert.equal(participantEvidenceRatio(frame, region, colored), expected, `${color}/${colored}`)
    assert.deepEqual(rgba, original)
  }
})

test('measures only the projected evidence rectangle rather than adjacent nickname pixels', () => {
  const rgba = Uint8ClampedArray.from([
    200, 200, 200, 128, 99, 99, 99, 0, 100, 100, 100, 255, 200, 200, 200, 128
  ])
  const frame = { width: 4, height: 1, rgba }

  assert.equal(participantEvidenceRatio(frame, { x: 1, y: 0, width: 2, height: 1 }), 0.5)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  hasParticipantEvidence,
  participantEvidenceRatio
} from '../dist/dnf-participant-evidence.js'

test('참가 근거 세 쌍의 비율 경계를 포함하고 두 신호 이상을 요구한다', () => {
  const thresholds = { portrait: 0.12, level: 0.035, role: 0.1 }
  for (let mask = 0; mask < 8; mask += 1) {
    const evidence = {
      portrait: mask & 1 ? thresholds.portrait : thresholds.portrait - Number.EPSILON,
      level: mask & 2 ? thresholds.level : thresholds.level - Number.EPSILON,
      role: mask & 4 ? thresholds.role : thresholds.role - Number.EPSILON
    }
    const expected = [3, 5, 6, 7].includes(mask)

    assert.equal(hasParticipantEvidence(evidence), expected, `참가 근거 조합 ${mask}`)
    for (const key of Object.keys(thresholds)) {
      if (evidence[key] === thresholds[key]) {
        assert.equal(
          hasParticipantEvidence({ ...evidence, [key]: thresholds[key] + Number.EPSILON }),
          expected,
          `참가 근거 조합 ${mask}에서 ${key}가 경계 바로 위인 경우`
        )
      }
    }
  }
})

test('채널 위치와 alpha에 관계없이 밝기와 역할 색상의 포함 경계를 유지한다', () => {
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

test('인접 닉네임 픽셀을 제외하고 지정한 근거 사각형만 측정한다', () => {
  const rgba = Uint8ClampedArray.from([
    200, 200, 200, 128, 99, 99, 99, 0, 100, 100, 100, 255, 200, 200, 200, 128
  ])
  const frame = { width: 4, height: 1, rgba }

  assert.equal(participantEvidenceRatio(frame, { x: 1, y: 0, width: 2, height: 1 }), 0.5)
})

test('여러 행의 근거 영역은 frame stride와 전체 면적으로 비율을 계산한다', () => {
  const outside = [255, 255, 255, 255]
  const pixels = [
    [outside, outside, outside, outside],
    [outside, [100, 100, 100, 0], [120, 60, 60, 17], outside],
    [outside, [99, 99, 99, 255], [119, 59, 59, 128], outside]
  ]
  const rgba = Uint8Array.from(pixels.flat(2))
  const original = rgba.slice()
  const image = Object.freeze({ width: 4, height: 3, rgba })
  const region = Object.freeze({ x: 1, y: 1, width: 2, height: 2 })

  // 네 내부 픽셀 중 밝기 100 이상은 셋, 역할 밝기·색상 차이 근거는 하나다.
  assert.equal(participantEvidenceRatio(image, region), 0.75)
  assert.equal(participantEvidenceRatio(image, region, true), 0.25)
  assert.deepEqual(rgba, original)
})

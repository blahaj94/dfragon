import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectParticipantRectangle } from '../dist/dnf-participant-regions.js'

test('음수 경계와 이동량을 포함해 각 모서리를 반 픽셀에서 짝수로 반올림한다', () => {
  const heading = { x: 0, y: 0, scale: 1.5 }
  const bounds = { left: -1, top: 1, right: 3, bottom: 3 }
  const original = { ...bounds }

  assert.deepEqual(projectParticipantRectangle(heading, bounds), {
    x: -2,
    y: 2,
    width: 6,
    height: 2
  })
  assert.deepEqual(projectParticipantRectangle({ ...heading, x: 1, y: 1 }, bounds), {
    x: 0,
    y: 2,
    width: 6,
    height: 4
  })
  assert.deepEqual(bounds, original)
  assert.deepEqual(heading, { x: 0, y: 0, scale: 1.5 })
})

test('정밀 탐색의 소수 배율에서도 파티와 공대 외곽 경계를 유지한다', () => {
  const heading = { x: 500, y: 200, scale: 1.28 - 2 * 0.0025 }

  assert.deepEqual(
    projectParticipantRectangle(heading, { left: -14, top: -67, right: 380, bottom: 143 }),
    { x: 482, y: 115, width: 502, height: 267 }
  )
  assert.deepEqual(
    projectParticipantRectangle(heading, { left: -15, top: -68, right: 450, bottom: 324 }),
    { x: 481, y: 113, width: 593, height: 500 }
  )
})

test('각 행의 모서리를 따로 반올림해 소수 간격과 서로 다른 높이를 유지한다', () => {
  const heading = Object.freeze({ x: 0, y: 0, scale: 1.25 })
  // 파티참가인원 기준의 네 닉네임 경계. 27.5px 행 간격을 먼저 정수화하지 않는다.
  const bounds = [
    { left: 154, top: 20, right: 238, bottom: 35 },
    { left: 154, top: 42, right: 238, bottom: 57 },
    { left: 154, top: 64, right: 238, bottom: 79 },
    { left: 154, top: 86, right: 238, bottom: 101 }
  ].map(Object.freeze)

  assert.deepEqual(
    bounds.map((region) => projectParticipantRectangle(heading, region)),
    [
      { x: 192, y: 25, width: 106, height: 19 },
      { x: 192, y: 52, width: 106, height: 19 },
      { x: 192, y: 80, width: 106, height: 19 },
      { x: 192, y: 108, width: 106, height: 18 }
    ]
  )
})

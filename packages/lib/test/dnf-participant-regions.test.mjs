import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectParticipantRectangle } from '../dist/dnf-participant-regions.js'

test('projects each edge with ties-to-even, including translated negative boundaries', () => {
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

test('retains the party and raid window layouts at a refined fractional scale', () => {
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

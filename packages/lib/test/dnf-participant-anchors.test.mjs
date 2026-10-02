import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findParticipantAnchors } from '../dist/dnf-party-participant-matching.js'

function component(width, height, color = [235, 20, 25, 128], count = width * height) {
  const frameWidth = 40
  const frameHeight = 40
  const rgba = new Uint8Array(frameWidth * frameHeight * 4)
  // A connected L first keeps both dimensions fixed even in sparse fill-ratio fixtures.
  const pixels = new Set()
  for (let x = 0; x < width; x += 1) {
    pixels.add(x)
  }
  for (let y = 0; y < height; y += 1) {
    pixels.add(y * width)
  }
  for (let index = 0; pixels.size < count; index += 1) {
    pixels.add(index)
  }
  for (const pixel of pixels) {
    const x = 4 + (pixel % width)
    const y = 4 + Math.floor(pixel / width)
    rgba.set(color, (y * frameWidth + x) * 4)
  }

  return { width: frameWidth, height: frameHeight, rgba }
}

function anchors(image) {
  return findParticipantAnchors(image.width, image.height, image.rgba)
}

test('keeps red intensity and channel differences inclusive at their measured boundaries', () => {
  for (const [color, expected] of [
    [[129, 0, 0, 255], 0],
    [[130, 0, 0, 0], 1],
    [[131, 0, 0, 128], 1],
    [[180, 106, 0, 255], 0],
    [[180, 105, 0, 255], 1],
    [[180, 104, 0, 255], 1],
    [[180, 0, 126, 255], 0],
    [[180, 0, 125, 255], 1],
    [[180, 0, 124, 255], 1]
  ]) {
    const image = component(9, 9, color)
    const original = image.rgba.slice()

    assert.equal(anchors(image).length, expected, String(color))
    assert.deepEqual(image.rgba, original)
  }
})

test('preserves the inclusive size and aspect-ratio limits for connected red components', () => {
  for (const [width, height, expected] of [
    [5, 6, 0],
    [6, 5, 0],
    [6, 6, 1],
    [7, 7, 1],
    [29, 29, 1],
    [30, 30, 1],
    [31, 30, 0],
    [30, 31, 0],
    [12, 20, 0],
    [13, 20, 1],
    [14, 20, 1],
    [8, 6, 1],
    [9, 6, 1],
    [10, 6, 0]
  ]) {
    assert.equal(anchors(component(width, height)).length, expected, `${width}x${height}`)
  }
})

test('preserves the 45 percent fill boundary and the 9px reference-scale interpretation', () => {
  for (const [count, expected] of [
    [44, 0],
    [45, 1],
    [46, 1]
  ]) {
    assert.equal(anchors(component(10, 10, undefined, count)).length, expected, `${count}/100`)
  }
  assert.deepEqual(anchors(component(9, 9)), [{ x: 8, y: 8, scale: 1 }])
  assert.equal(anchors(component(6, 6))[0].scale, 2 / 3)
  assert.equal(anchors(component(30, 30))[0].scale, 10 / 3)
})

test('accepts exactly 128 anchors and refuses a partial list when the next anchor exceeds the limit', () => {
  const width = 400
  const height = 220
  const rgba = new Uint8Array(width * height * 4)
  for (let index = 0; index < 129; index += 1) {
    const left = 10 + (index % 16) * 20
    const top = 10 + Math.floor(index / 16) * 20
    for (let y = top; y < top + 9; y += 1) {
      for (let x = left; x < left + 9; x += 1) {
        rgba.set([235, 20, 25, 255], (y * width + x) * 4)
      }
    }
    if (index === 127) {
      assert.equal(findParticipantAnchors(width, height, rgba).length, 128)
    }
  }
  assert.equal(findParticipantAnchors(width, height, rgba), null)
})

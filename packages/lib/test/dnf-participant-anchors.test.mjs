import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findParticipantAnchors } from '../dist/dnf-party-participant-matching.js'

function component(width, height, color = [235, 20, 25, 128], count = width * height) {
  const frameWidth = 40
  const frameHeight = 40
  const rgba = new Uint8Array(frameWidth * frameHeight * 4)
  // 연결된 L을 먼저 그려 채움 비율이 낮은 fixture도 같은 가로·세로 크기를 유지한다.
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

test('빨간 밝기와 채널 차이의 실측 경계를 포함한다', () => {
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

test('빨간 연결 영역의 크기와 종횡비 제한 경계를 포함한다', () => {
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

test('45% 채움 비율 경계와 9px 기준 배율 의미를 유지한다', () => {
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

test('앵커 128개는 허용하고 다음 앵커가 한도를 넘으면 부분 목록을 거절한다', () => {
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

test('대각선으로 닿은 빨간 영역도 8방향 연결 앵커 하나로 묶는다', () => {
  const width = 24
  const height = 24
  const rgba = new Uint8Array(width * height * 4)
  for (const [left, top] of [
    [2, 2],
    [11, 11]
  ]) {
    for (let y = top; y < top + 9; y += 1) {
      for (let x = left; x < left + 9; x += 1) {
        rgba.set([235, 20, 25, 0], (y * width + x) * 4)
      }
    }
  }
  const original = rgba.slice()

  // 18×18 외곽 안의 두 9×9 블록은 50%를 채우며 중심은 (10.5, 10.5)다.
  assert.deepEqual(findParticipantAnchors(width, height, rgba), [{ x: 10.5, y: 10.5, scale: 2 }])
  assert.deepEqual(rgba, original)
})

test('배열에서 붙은 행의 양 끝 픽셀을 화면상의 이웃으로 연결하지 않는다', () => {
  const width = 30
  const height = 12
  const rgba = new Uint8Array(width * height * 4)
  for (const [left, top] of [
    [24, 0],
    [0, 6]
  ]) {
    for (let y = top; y < top + 6; y += 1) {
      for (let x = left; x < left + 6; x += 1) {
        rgba.set([235, 20, 25, 255], (y * width + x) * 4)
      }
    }
  }
  const actual = findParticipantAnchors(width, height, rgba).sort((left, right) => left.x - right.x)

  assert.deepEqual(actual, [
    { x: 2.5, y: 8.5, scale: 2 / 3 },
    { x: 26.5, y: 2.5, scale: 2 / 3 }
  ])
})

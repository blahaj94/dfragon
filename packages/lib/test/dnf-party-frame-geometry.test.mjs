import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detectPartyFrameGeometry } from '../dist/dnf-party-frame-geometry.js'

const WIDTH = 1067
const HEIGHT = 600
const HP = [216, 0, 0]
const MP = [0, 120, 216]
const BORDER = [0, 0, 0]
const FRAME_EDGE = [225, 201, 153]

// 실기 1067×600 캡처에서 잰 파티 프레임 한 칸의 막대, 테두리 배치다.
function partyFrame(background) {
  const anchorX = 42
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4)
  const paint = (x, y, [red, green, blue]) => rgba.set([red, green, blue, 255], (y * WIDTH + x) * 4)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      paint(x, y, background)
    }
  }
  for (let y = 26; y <= 36; y += 1) {
    paint(anchorX - 2, y, FRAME_EDGE)
    for (let x = anchorX - 1; x <= anchorX + 99; x += 1) {
      paint(x, y, BORDER)
    }
    paint(anchorX + 100, y, FRAME_EDGE)
  }
  for (let x = anchorX; x < anchorX + 99; x += 1) {
    for (let y = 27; y <= 29; y += 1) {
      paint(x, y, HP)
    }
    for (let y = 33; y <= 35; y += 1) {
      paint(x, y, MP)
    }
  }

  return { width: WIDTH, height: HEIGHT, rgba }
}

test('테두리 너머 배경이 MP 막대 색이어도 막대를 배경과 이어 붙이지 않는다', () => {
  const nightSky = [28, 75, 208]

  const geometry = detectPartyFrameGeometry(partyFrame(nightSky))

  assert.equal(geometry.scale, 1)
  assert.deepEqual(
    geometry.slots.map(({ slot }) => slot),
    [1]
  )
})

test('테두리 너머 배경이 HP 막대 색이어도 막대를 배경과 이어 붙이지 않는다', () => {
  const orangeWall = [184, 72, 8]

  const geometry = detectPartyFrameGeometry(partyFrame(orangeWall))

  assert.deepEqual(
    geometry.slots.map(({ slot }) => slot),
    [1]
  )
})

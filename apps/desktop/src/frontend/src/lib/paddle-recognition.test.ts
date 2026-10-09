import { expect, it } from 'vitest'
import {
  decodeCtc,
  normalizedBgr,
  normalizedNicknameBgr,
  recognitionInputRgba
} from './paddle-recognition'

/** 흰 배경의 지정 위치에 명암을 넣어 실제 글자 폭과 세로 위치를 고정한다. */
function nickname(width: number, rows: readonly (readonly number[])[]): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * rows.length * 4)
  rgba.fill(255)
  for (let y = 0; y < rows.length; y += 1) {
    for (const x of rows[y]) {
      rgba.set([0, 0, 0, 255], (y * width + x) * 4)
    }
  }

  return rgba
}

it('정규화한 BGR channel 순서와 오른쪽 zero padding을 보존한다', () => {
  const values = normalizedBgr(new Uint8ClampedArray([255, 0, 127, 255]), 1, 1, 2)
  expect(Array.from(values)).toEqual([expect.closeTo(-1 / 255), 0, -1, 0, 1, 0])
})

it('크롭 여백이 아닌 실제 글자 경계를 입력 가운데에 놓고 좌우 여백을 흰색으로 채운다', () => {
  const pixels = nickname(10, [[], [1, 2], [3]])
  const original = pixels.slice()
  const values = normalizedNicknameBgr(pixels, 10, 3, 14)
  const channel = [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, -1, 1, 1, 1, 1, 1, 1
  ]

  expect([...values]).toEqual([...channel, ...channel, ...channel])
  expect(pixels).toEqual(original)
})

// 높이 5의 위아래 1행 여백에만 걸친 프레임 점은 경계 계산에서 빠지고 글자와 함께 밀려난다.
it.each([
  { name: '왼쪽', rows: [[9], [], [0, 1, 2], [], []] },
  { name: '오른쪽', rows: [[], [], [7, 8, 9], [], [0]] }
])('$name 글자를 옮길 때 입력 밖으로 밀린 프레임 픽셀은 다른 행에 쓰지 않는다', ({ rows }) => {
  const values = normalizedNicknameBgr(nickname(10, rows), 10, 5, 10)
  const blank = Array(10).fill(1)
  const channel = [...blank, ...blank, 1, 1, 1, -1, -1, -1, 1, 1, 1, 1, ...blank, ...blank]

  expect([...values]).toEqual([...channel, ...channel, ...channel])
})

it('떨어진 한 픽셀 구두점과 옅은 리사이즈 경계도 글자 폭에 포함한다', () => {
  const pixels = nickname(8, [[1, 2], [], [6]])
  pixels.set([254, 254, 254, 255], (2 * 8 + 7) * 4)
  const values = normalizedNicknameBgr(pixels, 8, 3, 12)

  expect([...values.slice(0, 12)]).toEqual([1, 1, -1, -1, 1, 1, 1, 1, 1, 1, 1, 1])
  expect(values[2 * 12 + 7]).toBe(-1)
  expect(values[2 * 12 + 8]).toBeCloseTo(254 / 127.5 - 1)
})

it('글자가 없는 입력은 좌우 여백까지 흰색으로 채운다', () => {
  const values = normalizedNicknameBgr(nickname(4, [[]]), 4, 1, 8)

  expect([...values]).toEqual(Array(3 * 8).fill(1))
})

it('모델 입력을 RGB 순서의 원래 픽셀로 되돌리고 zero padding은 회색으로 표시한다', () => {
  const values = normalizedBgr(new Uint8ClampedArray([255, 0, 127, 255]), 1, 1, 2)

  expect([...recognitionInputRgba(values, 2, 1)]).toEqual([255, 0, 127, 255, 128, 128, 128, 255])
})

it('가운데로 옮긴 글자 위치를 그대로 보여준다', () => {
  const values = normalizedNicknameBgr(nickname(4, [[0, 1]]), 4, 1, 8)
  const rgba = recognitionInputRgba(values, 8, 1)
  const red = [...rgba].filter((_, index) => index % 4 === 0)

  expect(red).toEqual([255, 255, 255, 0, 0, 255, 255, 255])
})

it('모델 입력 크기와 맞지 않는 값은 확인용 이미지로 바꾸지 않는다', () => {
  const values = normalizedBgr(new Uint8ClampedArray(8 * 4), 8, 1, 8)

  expect(() => recognitionInputRgba(values, 8, 2)).toThrow(TypeError)
})

it('CTC의 연속 출력은 합치고 blank로 분리한 같은 한글은 보존한다', () => {
  const data = new Float32Array([
    0.05, 0.9, 0.05, 0.05, 0.9, 0.05, 0.9, 0.05, 0.05, 0.05, 0.9, 0.05, 0.05, 0.05, 0.9
  ])
  expect(decodeCtc(data, 5, ['가', '나'])).toBe('가가나')
  expect(decodeCtc(new Float32Array([1, 0, 0]), 1, ['가', '나'])).toBe('')
})

import { expect, it } from 'vitest'
import { normalizedBgr, normalizedNicknameBgr } from './paddle-recognition'

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

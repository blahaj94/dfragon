import { expect, it } from 'vitest'
import { decodeCtc, normalizedBgr } from './paddle-recognition'

it('정규화한 BGR channel 순서와 오른쪽 zero padding을 보존한다', () => {
  const values = normalizedBgr(new Uint8ClampedArray([255, 0, 127, 255]), 1, 1, 2)
  expect(Array.from(values)).toEqual([expect.closeTo(-1 / 255), 0, -1, 0, 1, 0])
})
it('CTC의 연속 출력은 합치고 blank로 분리한 같은 한글은 보존한다', () => {
  const data = new Float32Array([
    0.05, 0.9, 0.05, 0.05, 0.9, 0.05, 0.9, 0.05, 0.05, 0.05, 0.9, 0.05, 0.05, 0.05, 0.9
  ])
  expect(decodeCtc(data, 5, ['가', '나'])).toEqual({
    text: '가가나',
    confidence: expect.closeTo(90)
  })
  expect(decodeCtc(new Float32Array([1, 0, 0]), 1, ['가', '나'])).toEqual({
    text: '',
    confidence: 0
  })
})

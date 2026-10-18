// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { recognizeRaidRows } from './raid-recognition'
import type { PartyOcrResult, PartyOcrWorker } from '../types/capture'

const recognize = vi.fn<PartyOcrWorker['recognize']>()
// jsdom에는 canvas 구현이 없어 인식에 넘긴 canvas의 픽셀만 기록하는 2d 문맥을 둔다.
const drawn = new Map<HTMLCanvasElement, Uint8ClampedArray>()

function result(nickname: string): { data: PartyOcrResult } {
  return {
    data: {
      text: nickname,
      confidence: 90,
      candidates: [
        { rank: 1, modelScore: 90, nickname },
        { rank: 2, modelScore: 10, nickname: '다른후보' }
      ]
    }
  }
}

function crop(gray: number[]): { width: number; height: number; rgba: Uint8Array } {
  const rgba = new Uint8Array(gray.flatMap((value) => [value, value, value, 255]))

  return { width: gray.length, height: 1, rgba }
}

beforeEach(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value(this: HTMLCanvasElement) {
      return {
        createImageData: (width: number, height: number) => ({
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4)
        }),
        putImageData: (image: { data: Uint8ClampedArray }) => {
          drawn.set(this, Uint8ClampedArray.from(image.data))
        }
      }
    }
  })
})

afterEach(() => {
  Reflect.deleteProperty(HTMLCanvasElement.prototype, 'getContext')
  drawn.clear()
  recognize.mockReset()
})

it('크롭이 없는 행은 OCR 없이 빈 자리로 두고 행 번호를 자리 번호로 쓴다', async () => {
  recognize.mockResolvedValue(result('공대원'))
  const nicknames = Array.from({ length: 12 }, (_, row) => (row === 2 ? crop([30, 220]) : null))

  const results = await recognizeRaidRows(nicknames, recognize)

  expect(results).toHaveLength(12)
  expect(results[2]).toEqual({ kind: 'recognized', nickname: '공대원', slot: 2 })
  expect(results.filter((item) => item.kind === 'missing').map((item) => item.slot)).toEqual([
    0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11
  ])
  expect(recognize).toHaveBeenCalledOnce()
})

it('파티 캡처와 같은 반전 이진화를 거친 canvas를 인식에 넘긴다', async () => {
  recognize.mockResolvedValue(result('공대원'))

  await recognizeRaidRows([crop([20, 230])], recognize)

  const canvas = recognize.mock.calls[0][0]
  expect([canvas.width, canvas.height]).toEqual([2, 1])
  // 어두운 배경은 흰색, 밝은 글자는 검은색이 된다.
  expect([...drawn.get(canvas)!]).toEqual([255, 255, 255, 255, 0, 0, 0, 255])
})

it.each([
  ['', 'empty'],
  ['가'.repeat(13), 'too-long']
] as const)('첫 후보 %j는 검색에 쓰지 않고 %s로 거절한다', async (nickname, rejection) => {
  recognize.mockResolvedValue(result(nickname))

  const [first] = await recognizeRaidRows([crop([20, 230])], recognize)

  expect(first).toEqual({ kind: 'rejected', rejection, text: nickname, slot: 0 })
})

it('한 행의 인식 실패는 그 행만 실패로 남기고 다음 행을 계속 읽는다', async () => {
  recognize.mockRejectedValueOnce(new Error('worker')).mockResolvedValueOnce(result('다음'))

  const results = await recognizeRaidRows([crop([20, 230]), crop([20, 230])], recognize)

  expect(results).toEqual([
    { kind: 'failed', slot: 0 },
    { kind: 'recognized', nickname: '다음', slot: 1 }
  ])
})

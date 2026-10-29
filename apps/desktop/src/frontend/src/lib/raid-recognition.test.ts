// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { recognizeRaidRows } from './raid-recognition'
import type { PartyOcrResult, PartyOcrWorker } from '../types/capture'

const recognize = vi.fn<PartyOcrWorker['recognize']>()
// jsdom에는 canvas 구현이 없어 인식에 넘긴 canvas의 픽셀만 기록하는 2d 문맥을 둔다.
const drawn = new Map<HTMLCanvasElement, Uint8ClampedArray>()

function result(nickname: string): PartyOcrResult {
  return {
    candidates: [
      { rank: 1, modelScore: 90, nickname },
      { rank: 2, modelScore: 10, nickname: '다른후보' }
    ]
  }
}

function crop(gray: number[]): { width: number; height: number; rgba: Uint8Array } {
  const rgba = new Uint8Array(gray.flatMap((value) => [value, value, value, 255]))

  return { width: gray.length, height: 1, rgba }
}

function row(job: ReturnType<typeof crop> | null = null) {
  return { nickname: crop([20, 230]), job, valueText: '12,345' }
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

it('크롭이 없는 행은 OCR 없이 빈 슬롯으로 두고 행 번호를 슬롯 번호로 쓴다', async () => {
  recognize.mockResolvedValue(result('공대원'))
  const rows = Array.from({ length: 12 }, (_, index) => (index === 2 ? row() : null))

  const results = await recognizeRaidRows(rows, recognize)

  expect(results).toHaveLength(12)
  expect(results[2]).toEqual({ kind: 'recognized', nickname: '공대원', slot: 2, jobText: null })
  expect(results.filter((item) => item.kind === 'missing').map((item) => item.slot)).toEqual([
    0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11
  ])
  expect(recognize).toHaveBeenCalledOnce()
})

it('파티 캡처와 같은 반전 이진화를 거친 canvas를 인식에 넘긴다', async () => {
  recognize.mockResolvedValue(result('공대원'))

  await recognizeRaidRows([row()], recognize)

  const canvas = recognize.mock.calls[0][0]
  expect([canvas.width, canvas.height]).toEqual([2, 1])
  expect([...drawn.get(canvas)!]).toEqual([255, 255, 255, 255, 0, 0, 0, 255])
})

it('닉네임 칸에서만 본문과 떨어진 점을 지우고 직업명 칸은 그대로 이진화한다', async () => {
  recognize.mockResolvedValueOnce(result('공대원')).mockResolvedValueOnce(result('크루세이더'))
  const detached = crop([230, 20, 230, 230])

  await recognizeRaidRows([{ nickname: detached, job: detached, valueText: '12,345' }], recognize)

  const [nicknameCanvas, jobCanvas] = recognize.mock.calls.map(([canvas]) => drawn.get(canvas)!)
  expect([...nicknameCanvas].filter((_, index) => index % 4 === 0)).toEqual([255, 255, 0, 0])
  expect([...jobCanvas].filter((_, index) => index % 4 === 0)).toEqual([0, 255, 0, 0])
})

it.each([
  ['', 'empty'],
  ['가'.repeat(13), 'too-long']
] as const)('첫 후보 %j는 검색에 쓰지 않고 %s로 거절한다', async (nickname, rejection) => {
  recognize.mockResolvedValue(result(nickname))

  const [first] = await recognizeRaidRows([row(crop([20, 230, 20]))], recognize)

  expect(first).toEqual({ kind: 'rejected', rejection, text: nickname, slot: 0, jobText: null })
  expect(recognize).toHaveBeenCalledOnce()
})

it('한 행의 인식 실패는 그 행만 실패로 남기고 다음 행을 계속 읽는다', async () => {
  recognize.mockRejectedValueOnce(new Error('worker')).mockResolvedValueOnce(result('다음'))

  const results = await recognizeRaidRows([row(), row()], recognize)

  expect(results).toEqual([
    { kind: 'failed', slot: 0 },
    { kind: 'recognized', nickname: '다음', slot: 1, jobText: null }
  ])
})

it('직업명 칸도 닉네임과 같은 반전 이진화로 읽고 1위 문자열의 앞뒤 공백만 지운다', async () => {
  recognize.mockResolvedValueOnce(result('공대원')).mockResolvedValueOnce(result(' 眞 크루세이더 '))

  const [first] = await recognizeRaidRows([row(crop([20, 230, 20]))], recognize)

  expect(first).toEqual({
    kind: 'recognized',
    nickname: '공대원',
    slot: 0,
    jobText: '眞 크루세이더'
  })
  const jobCanvas = recognize.mock.calls[1][0]
  expect(jobCanvas.width).toBe(3)
  expect([...drawn.get(jobCanvas)!]).toEqual([255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255])
})

it.each([
  ['인식이 실패하면', () => recognize.mockRejectedValueOnce(new Error('worker'))],
  ['1위 문자열이 비어 있으면', () => recognize.mockResolvedValueOnce(result(' '))],
  ['1위 문자열이 상한보다 길면', () => recognize.mockResolvedValueOnce(result('가'.repeat(33)))]
])('직업명 %s 행은 실패로 두지 않고 직업명만 null이다', async (_case, arrange) => {
  recognize.mockResolvedValueOnce(result('공대원'))
  arrange()

  const [first] = await recognizeRaidRows([row(crop([20, 230, 20]))], recognize)

  expect(first).toEqual({ kind: 'recognized', nickname: '공대원', slot: 0, jobText: null })
})

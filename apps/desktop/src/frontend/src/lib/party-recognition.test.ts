// @vitest-environment jsdom

import { beforeEach, expect, it, vi } from 'vitest'
import { capturePartyRecognitionInputs } from './party'
import { recognizePartyFrame } from './party-recognition'
import type { PartyOcrWorker } from '../types/capture'

vi.mock('./party', () => ({ capturePartyRecognitionInputs: vi.fn() }))

const frame = { width: 1, height: 1, rgba: new Uint8Array([1, 2, 3, 255]) }
const nickname = document.createElement('canvas')
const portrait = { image: frame, rasterScale: 1 }
const recognize = vi.fn<PartyOcrWorker['recognize']>()

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(capturePartyRecognitionInputs).mockReturnValue([
    { slot: 0, nickname, portrait },
    null,
    null,
    null
  ])
})

it('검출하지 못한 슬롯은 OCR 없이 미검출 결과로 돌려준다', async () => {
  vi.mocked(capturePartyRecognitionInputs).mockReturnValue([null, null, null, null])
  expect(await recognizePartyFrame(frame, recognize)).toEqual([
    { kind: 'missing', slot: 0 },
    { kind: 'missing', slot: 1 },
    { kind: 'missing', slot: 2 },
    { kind: 'missing', slot: 3 }
  ])
  expect(recognize).not.toHaveBeenCalled()
})

it.each([' 검사* ', '가 나', '😀'.repeat(12)])(
  '첫 후보 %j를 한 번 읽고 얼굴을 보존한다',
  async (first) => {
    recognize.mockResolvedValue({
      data: {
        text: ' 테-스_트! ABC 123 ',
        confidence: 1,
        candidates: [
          { nickname: first, rank: 1, modelScore: 1 },
          { nickname: '다른후보', rank: 2, modelScore: 0.5 }
        ]
      }
    })
    const results = await recognizePartyFrame(frame, recognize)
    expect(capturePartyRecognitionInputs).toHaveBeenCalledExactlyOnceWith(frame)
    expect(recognize).toHaveBeenCalledExactlyOnceWith(nickname)
    expect(results).toEqual([
      {
        kind: 'recognized',
        slot: 0,
        nickname: first.trim(),
        portrait,
        legacyNickname: '테스트ABC123'
      },
      { kind: 'missing', slot: 1 },
      { kind: 'missing', slot: 2 },
      { kind: 'missing', slot: 3 }
    ])
  }
)

it.each([
  [null, 'missing'],
  ['', 'empty'],
  ['  ', 'empty'],
  ['a'.repeat(13), 'too-long'],
  ['😀'.repeat(13), 'too-long'],
  ['\uD800', 'malformed'],
  ['\uDC00', 'malformed']
] as const)('첫 후보 %j는 %s로 거절하며 낮은 후보로 대체하지 않는다', async (text, rejection) => {
  const candidates =
    text === null
      ? []
      : [
          { nickname: text, rank: 1, modelScore: 1 },
          { nickname: '정상후보', rank: 2, modelScore: 0.5 }
        ]
  recognize.mockResolvedValue({ data: { text: '', confidence: 1, candidates } })
  expect((await recognizePartyFrame(frame, recognize))[0]).toEqual({
    kind: 'rejected',
    slot: 0,
    rejection,
    text,
    portrait,
    legacyNickname: ''
  })
})

it('OCR 예외는 얼굴을 포함한 실패 결과로 남기고 뒤 슬롯도 처리한다', async () => {
  const nextNickname = document.createElement('canvas')
  vi.mocked(capturePartyRecognitionInputs).mockReturnValue([
    { slot: 0, nickname, portrait },
    null,
    { slot: 2, nickname: nextNickname, portrait: null },
    null
  ])
  recognize.mockRejectedValue(new Error('OCR unavailable'))

  expect(await recognizePartyFrame(frame, recognize)).toEqual([
    { kind: 'failed', slot: 0, portrait },
    { kind: 'missing', slot: 1 },
    { kind: 'failed', slot: 2, portrait: null },
    { kind: 'missing', slot: 3 }
  ])
  expect(recognize).toHaveBeenCalledTimes(2)
  expect(recognize.mock.calls[0][0]).toBe(nickname)
  expect(recognize.mock.calls[1][0]).toBe(nextNickname)
})

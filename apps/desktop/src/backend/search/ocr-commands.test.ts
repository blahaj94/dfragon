import { describe, expect, it } from 'vitest'
import { parseOcrSearchObservation, parseSearchObservation } from './commands'

const captureId = '00000000-0000-4000-8000-000000000011'
const portrait = { image: { width: 2, height: 1, rgba: new Uint8Array(8) }, rasterScale: 1 }
const observation = {
  captureId,
  slot: 0,
  observationRevision: 1,
  nickname: '가',
  candidateNicknames: ['가', '나'],
  portrait
}

describe('OCR 관측 IPC의 제한된 입력 계약', () => {
  it('한 글자와 12 code point 후보를 보정 없이 받고 일반 관측 채널과 구분한다', () => {
    const input = { ...observation, candidateNicknames: ['가', '😀'.repeat(12)] }
    expect(parseOcrSearchObservation([input])).toEqual(input)
    expect(parseOcrSearchObservation([{ ...input, portrait: null }])).toEqual({
      ...input,
      portrait: null
    })
    expect(parseSearchObservation([input])).toBeNull()
  })

  it('빈 첫 후보는 조회 실패를 표시하도록 원문 그대로 전달한다', () => {
    const input = { ...observation, nickname: '', candidateNicknames: ['', '가'] }
    expect(parseOcrSearchObservation([input])).toEqual(input)
  })

  it('두 번째 후보의 내용은 첫 후보 접수 여부를 바꾸지 않는다', () => {
    for (const ignored of ['', ' 나', '\ud800']) {
      const input = { ...observation, candidateNicknames: ['가', ignored] }
      expect(parseOcrSearchObservation([input])).toEqual(input)
    }
  })

  it.each([
    ['빈 후보', { ...observation, candidateNicknames: [] }],
    ['세 후보', { ...observation, candidateNicknames: ['가', '나', '다'] }],
    ['대표 이름 불일치', { ...observation, nickname: '나' }],
    ['공백 보정 필요', { ...observation, nickname: ' 가', candidateNicknames: [' 가', '나'] }],
    [
      '13 code point',
      { ...observation, nickname: '😀'.repeat(13), candidateNicknames: ['😀'.repeat(13), '가'] }
    ],
    [
      '깨진 surrogate',
      { ...observation, nickname: '\ud800', candidateNicknames: ['\ud800', '나'] }
    ],
    ['배열이 아닌 후보', { ...observation, candidateNicknames: '가' }],
    ['정책 제출', { ...observation, policy: { maxMeanChannelError: 255 } }],
    ['이미지 URL 제출', { ...observation, portrait: 'https://example.test/face.png' }],
    [
      'portrait 누락',
      { captureId, slot: 0, observationRevision: 1, nickname: '가', candidateNicknames: ['가'] }
    ],
    [
      '이미지 너비 초과',
      { ...observation, portrait: { ...portrait, image: { ...portrait.image, width: 513 } } }
    ],
    [
      'RGBA 길이 불일치',
      {
        ...observation,
        portrait: { ...portrait, image: { ...portrait.image, rgba: new Uint8Array(4) } }
      }
    ],
    [
      '일반 픽셀 배열',
      {
        ...observation,
        portrait: { ...portrait, image: { ...portrait.image, rgba: Array(8).fill(0) } }
      }
    ],
    ['음수 배율', { ...observation, portrait: { ...portrait, rasterScale: -1 } }],
    ['무한 배율', { ...observation, portrait: { ...portrait, rasterScale: Infinity } }],
    ['너무 작은 배율', { ...observation, portrait: { ...portrait, rasterScale: 0.001 } }],
    ['마스크 길이', { ...observation, portrait: { ...portrait, validMask: new Uint8Array(1) } }],
    ['마스크 값', { ...observation, portrait: { ...portrait, validMask: new Uint8Array([0, 2]) } }],
    [
      '이미지 추가 필드',
      {
        ...observation,
        portrait: { ...portrait, image: { ...portrait.image, sourceUrl: 'private' } }
      }
    ],
    [
      '상속 이미지 너비',
      {
        ...observation,
        portrait: {
          ...portrait,
          image: Object.assign(Object.create({ width: 2 }), { height: 1, rgba: new Uint8Array(8) })
        }
      }
    ],
    [
      '숨긴 portrait 필드',
      {
        ...observation,
        portrait: Object.defineProperty({ ...portrait }, 'private', { value: true })
      }
    ]
  ])('%s는 허용하지 않는다', (_name, input) => {
    expect(parseOcrSearchObservation([input])).toBeNull()
  })

  it('추가 인자와 숨겨진 후보 배열 필드도 거절한다', () => {
    expect(parseOcrSearchObservation([observation, null])).toBeNull()
    const candidateNicknames = Object.defineProperty(['가'], 'private', { value: true })
    expect(parseOcrSearchObservation([{ ...observation, candidateNicknames }])).toBeNull()
  })
})

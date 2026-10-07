import { describe, expect, it } from 'vitest'
import { parseWindowFrame } from './capture-frame'

describe('네이티브 프레임 응답 검증', () => {
  it('크기와 픽셀이 일치하는 원본 RGBA를 전달한다', () => {
    const image = { width: 2, height: 1, rgba: new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255]) }

    expect(parseWindowFrame({ kind: 'frame', image })).toEqual({ kind: 'frame', image })
  })

  it.each([
    null,
    {},
    { kind: 'waiting', reason: 'internal path' },
    { kind: 'unsupported', extra: true },
    { kind: 'frame', image: { width: 1, height: 1, rgba: new Uint8Array(3) } },
    { kind: 'frame', image: { width: 1, height: 1, rgba: [0, 0, 0, 255] } },
    { kind: 'frame', image: { width: 0, height: 1, rgba: new Uint8Array() } },
    { kind: 'frame', image: { width: 1.5, height: 1, rgba: new Uint8Array(6) } },
    { kind: 'frame', image: { width: 8193, height: 1, rgba: new Uint8Array() } },
    { kind: 'frame', image: { width: 8192, height: 8192, rgba: new Uint8Array() } }
  ])('잘못된 IPC 응답을 노출하지 않는다: %j', (value) => {
    expect(() => parseWindowFrame(value)).toThrow('CAPTURE_RESPONSE_INVALID')
  })

  it.each(['covered', 'unavailable'] as const)('대기 사유 %s를 보존한다', (reason) => {
    expect(parseWindowFrame({ kind: 'waiting', reason })).toEqual({ kind: 'waiting', reason })
  })
})

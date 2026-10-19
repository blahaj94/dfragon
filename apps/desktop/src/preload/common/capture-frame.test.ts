import { describe, expect, it } from 'vitest'
import { parseRaidFrame, parseWindowFrame } from './capture-frame'

describe('네이티브 프레임 응답 검증', () => {
  it('크기와 픽셀이 일치하는 원본 RGBA를 전달한다', () => {
    const image = { width: 2, height: 1, rgba: new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255]) }

    expect(parseWindowFrame({ kind: 'frame', image })).toEqual({ kind: 'frame', image })
  })

  it('main 프레임의 UUID 참조를 보존하고 임의 경로나 추가 provenance 값은 거절한다', () => {
    const image = { width: 1, height: 1, rgba: new Uint8Array(4) }
    const frameId = '10000000-0000-4000-8000-000000000002'
    const result = { kind: 'frame', image, frameId }
    expect(parseWindowFrame(result)).toEqual(result)
    expect(() => parseWindowFrame({ ...result, frameId: '/tmp/image.png' })).toThrow()
    expect(() => parseWindowFrame({ ...result, path: '/tmp/image.png' })).toThrow()
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

describe('공대 캡처 응답 검증', () => {
  const nickname = { width: 2, height: 1, rgba: new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255]) }
  const row = { nickname, job: nickname, valueText: '1000.4K' }
  const rows = (filled: unknown = row): unknown[] =>
    Array.from({ length: 12 }, (_, index) => (index < 3 ? filled : null))
  const result = (overrides: Record<string, unknown> = {}) => ({
    kind: 'rows',
    valueColumn: 'equipment-score',
    rows: rows(),
    ...overrides
  })

  it('12행의 크롭, 수치 표기와 빈 행을 화면 순서대로 전달한다', () => {
    expect(parseRaidFrame(result())).toEqual(result())
    const unreadable = { nickname, job: null, valueText: null }
    expect(parseRaidFrame(result({ valueColumn: 'unknown', rows: rows(unreadable) }))).toEqual(
      result({ valueColumn: 'unknown', rows: rows(unreadable) })
    )
  })

  it.each([
    { kind: 'missing', reason: 'not-found' },
    { kind: 'missing', reason: 'uncertain' },
    { kind: 'waiting', reason: 'covered' },
    { kind: 'unsupported' }
  ])('정해진 미검출, 대기 사유 %j를 보존한다', (value) => {
    expect(parseRaidFrame(value)).toEqual(value)
  })

  it.each([
    null,
    { kind: 'frame', image: nickname },
    { kind: 'missing', reason: 'internal path' },
    { kind: 'missing', reason: 'not-found', extra: true },
    result({ rows: rows().slice(0, 11) }),
    result({ rows: [...rows(), null] }),
    result({ image: nickname }),
    result({ valueColumn: 'level' }),
    { kind: 'rows', rows: rows() },
    result({ rows: rows({ ...row, nickname: { ...nickname, rgba: new Uint8Array(4) } }) }),
    result({ rows: rows({ ...row, job: { ...nickname, path: '/tmp/crop.png' } }) }),
    result({
      rows: rows({ ...row, nickname: { width: 1025, height: 1, rgba: new Uint8Array(4100) } })
    }),
    result({ rows: rows({ ...row, job: { width: 1, height: 257, rgba: new Uint8Array(1028) } }) }),
    result({ rows: rows({ ...row, nickname: { width: 0, height: 1, rgba: new Uint8Array() } }) }),
    result({ rows: rows({ ...row, valueText: '12a' }) }),
    result({ rows: rows({ ...row, valueText: '' }) }),
    result({ rows: rows({ ...row, valueText: 12345 }) }),
    result({ rows: rows({ nickname, job: null }) }),
    result({ rows: rows({ ...row, extra: true }) }),
    result({ rows: Array.from({ length: 12 }, () => undefined) })
  ])('잘못된 공대 응답을 노출하지 않는다: %j', (value) => {
    expect(() => parseRaidFrame(value)).toThrow('CAPTURE_RESPONSE_INVALID')
  })
})

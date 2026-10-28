import { describe, expect, it } from 'vitest'
import { parseRaidFrame, parseWindowFrame } from './capture-frame'

describe('네이티브 프레임 응답 검증', () => {
  it('크기와 픽셀이 일치하는 원본 RGBA를 전달한다', () => {
    const image = { width: 2, height: 1, rgba: new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255]) }

    expect(parseWindowFrame({ kind: 'frame', image })).toEqual({ kind: 'frame', image })
  })

  it('지운 수집 프레임 참조나 임의 경로 같은 추가 값은 거절한다', () => {
    const image = { width: 1, height: 1, rgba: new Uint8Array(4) }
    const frameId = '10000000-0000-4000-8000-000000000002'
    expect(() => parseWindowFrame({ kind: 'frame', image, frameId })).toThrow()
    expect(() => parseWindowFrame({ kind: 'frame', image, path: '/tmp/image.png' })).toThrow()
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

  it.each([
    [8192, 1],
    [1, 8192],
    [1025, 257]
  ])('공대 크롭 상한을 넘는 %d×%d 파티 프레임도 받는다', (width, height) => {
    const image = { width, height, rgba: new Uint8Array(width * height * 4) }

    expect(parseWindowFrame({ kind: 'frame', image })).toEqual({ kind: 'frame', image })
  })

  it.each([
    ['높이 0', { width: 1, height: 0, rgba: new Uint8Array() }],
    ['음수 너비', { width: -1, height: 1, rgba: new Uint8Array() }],
    ['NaN 높이', { width: 1, height: Number.NaN, rgba: new Uint8Array() }],
    ['무한 너비', { width: Infinity, height: 1, rgba: new Uint8Array() }],
    ['문자 너비', { width: '1', height: 1, rgba: new Uint8Array(4) }],
    ['높이 8193', { width: 1, height: 8193, rgba: new Uint8Array(8193 * 4) }],
    ['픽셀이 넘치는 rgba', { width: 1, height: 1, rgba: new Uint8Array(5) }],
    ['rgba 누락', { width: 1, height: 1 }],
    ['rgba 대신 다른 필드', { width: 1, height: 1, pixels: new Uint8Array(4) }],
    ['배열 이미지', [1, 1, new Uint8Array(4)]]
  ])('%s 파티 프레임을 거절한다', (_name, image) => {
    expect(() => parseWindowFrame({ kind: 'frame', image })).toThrow('CAPTURE_RESPONSE_INVALID')
  })

  it('이미지가 빠진 파티 프레임을 거절한다', () => {
    expect(() => parseWindowFrame({ kind: 'frame' })).toThrow('CAPTURE_RESPONSE_INVALID')
    expect(() => parseWindowFrame({ kind: 'frame', rgba: new Uint8Array(4) })).toThrow(
      'CAPTURE_RESPONSE_INVALID'
    )
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
    [1024, 1],
    [1, 256]
  ])('%d×%d 크롭을 받는다', (width, height) => {
    const crop = { width, height, rgba: new Uint8Array(width * height * 4) }
    const filled = result({ rows: rows({ nickname: crop, job: crop, valueText: null }) })

    expect(parseRaidFrame(filled)).toEqual(filled)
  })

  it.each(['0', '1,234,567.8K', '9999999999999999'])('수치 표기 %s를 받는다', (valueText) => {
    const filled = result({ rows: rows({ ...row, valueText }) })

    expect(parseRaidFrame(filled)).toEqual(filled)
  })

  it.each([
    ['높이 0', { width: 1, height: 0, rgba: new Uint8Array() }],
    ['음수 높이', { width: 1, height: -1, rgba: new Uint8Array() }],
    ['소수 너비', { width: 1.5, height: 2, rgba: new Uint8Array(12) }],
    ['NaN 너비', { width: Number.NaN, height: 1, rgba: new Uint8Array() }],
    ['문자 높이', { width: 1, height: '1', rgba: new Uint8Array(4) }],
    ['배열 rgba', { width: 1, height: 1, rgba: [0, 0, 0, 255] }],
    ['픽셀이 넘치는 rgba', { width: 1, height: 1, rgba: new Uint8Array(8) }],
    ['rgba 누락', { width: 1, height: 1 }],
    ['rgba 대신 다른 필드', { width: 1, height: 1, pixels: new Uint8Array(4) }]
  ])('%s 직업 크롭을 거절한다', (_name, job) => {
    expect(() => parseRaidFrame(result({ rows: rows({ ...row, job }) }))).toThrow(
      'CAPTURE_RESPONSE_INVALID'
    )
  })

  it.each([
    ['17자 수치', '12345678901234567'],
    ['소문자 k', '1000k'],
    ['undefined 수치', undefined]
  ])('%s 행을 거절한다', (_name, valueText) => {
    expect(() => parseRaidFrame(result({ rows: rows({ ...row, valueText }) }))).toThrow(
      'CAPTURE_RESPONSE_INVALID'
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

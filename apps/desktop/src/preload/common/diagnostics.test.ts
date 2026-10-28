import { expect, it } from 'vitest'
import {
  parseDiagnosticEntry,
  parseDiagnosticHistory,
  isRendererDiagnosticCode
} from './diagnostics'
import { DIAGNOSTIC_HISTORY_LIMIT } from './types/diagnostics'

const entry = { sequence: 1, timestamp: 1_000, code: 'OCR_FAILED' }

it('진단 코드는 정확한 구조만 받으며 오류 메시지나 URL 속성이 섞이면 거부한다', () => {
  expect(parseDiagnosticEntry(entry)).toEqual(entry)
  for (const value of [
    { ...entry, message: 'synthetic private message' },
    { ...entry, url: 'https://synthetic.invalid/' },
    { ...entry, code: 'constructor' },
    { ...entry, code: 'UNKNOWN_ERROR' },
    { ...entry, sequence: -1 },
    { ...entry, timestamp: Number.NaN },
    null
  ]) {
    expect(parseDiagnosticEntry(value)).toBeNull()
  }
})

it('히스토리는 순서와 크기 한도를 검증하고 화면은 메인 오류 코드를 보고할 수 없다', () => {
  expect(parseDiagnosticHistory([entry, { ...entry, sequence: 2 }])).toHaveLength(2)
  expect(parseDiagnosticHistory([entry, entry])).toBeNull()
  expect(
    parseDiagnosticHistory(Array.from({ length: DIAGNOSTIC_HISTORY_LIMIT + 1 }, () => entry))
  ).toBeNull()
  expect(isRendererDiagnosticCode('OCR_FAILED')).toBe(true)
  expect(isRendererDiagnosticCode('MAIN_PROCESS_FAILED')).toBe(false)
})

it.each([
  ['처음 순번', { ...entry, sequence: 1 }],
  ['안전한 최대 순번', { ...entry, sequence: Number.MAX_SAFE_INTEGER }],
  ['0 시각', { ...entry, timestamp: 0 }],
  ['안전한 최대 시각', { ...entry, timestamp: Number.MAX_SAFE_INTEGER }]
])('%s 진단 항목을 받는다', (_name, value) => {
  expect(parseDiagnosticEntry(value)).toEqual(value)
})

it.each([
  ['0 순번', { ...entry, sequence: 0 }],
  ['소수 순번', { ...entry, sequence: 1.5 }],
  ['안전하지 않은 순번', { ...entry, sequence: Number.MAX_SAFE_INTEGER + 1 }],
  ['문자 순번', { ...entry, sequence: '1' }],
  ['음수 시각', { ...entry, timestamp: -1 }],
  ['소수 시각', { ...entry, timestamp: 0.5 }],
  ['무한 시각', { ...entry, timestamp: Infinity }],
  ['순번 누락', { timestamp: entry.timestamp, code: entry.code }],
  ['시각 누락', { sequence: entry.sequence, code: entry.code }],
  ['코드 누락', { sequence: entry.sequence, timestamp: entry.timestamp }],
  ['순번 대신 다른 필드', { id: 1, timestamp: entry.timestamp, code: entry.code }],
  ['배열', Object.assign([], entry)],
  ['undefined', undefined]
])('%s 진단 항목을 거절한다', (_name, value) => {
  expect(parseDiagnosticEntry(value)).toBeNull()
})

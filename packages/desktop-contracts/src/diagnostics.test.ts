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

import { beforeEach, expect, it, vi } from 'vitest'
import { reportSearchOutcome } from './diagnostics'
import type { SearchErrorCode } from '../../preload/common/types/search'
import type { DiagnosticCode } from '../../preload/common/types/diagnostics'

const report = vi.hoisted(() => vi.fn())
vi.mock('../diagnostics/log', () => ({ reportDiagnostic: report }))

beforeEach(() => report.mockClear())

const failureCases: [SearchErrorCode, DiagnosticCode][] = [
  ['SEARCH_TIMEOUT', 'SEARCH_TIMEOUT'],
  ['NEOPLE_TIMEOUT', 'SEARCH_TIMEOUT'],
  ['SEARCH_RESPONSE_INVALID', 'SEARCH_RESPONSE_INVALID'],
  ['SEARCH_NETWORK_ERROR', 'SEARCH_UNAVAILABLE'],
  ['NEOPLE_UNAVAILABLE', 'SEARCH_UNAVAILABLE'],
  ['SEARCH_RATE_LIMITED', 'SEARCH_FAILED']
]

it.each(failureCases)('%s 실패는 고정 진단 코드 %s만 남긴다', (code, expected) => {
  const error = { code, retryAfterSeconds: 15, providerMessage: 'synthetic private response' }
  reportSearchOutcome({ kind: 'failure', error, retryAfterReceivedAt: 123 })
  expect(report).toHaveBeenCalledExactlyOnceWith(expected)
})

it('취소된 결과와 일반 조회 성공은 오류로 기록하지 않는다', () => {
  reportSearchOutcome(null)
  reportSearchOutcome({ kind: 'success', rows: [] })
  expect(report).not.toHaveBeenCalled()
})

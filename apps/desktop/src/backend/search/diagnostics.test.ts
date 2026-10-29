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
  const error = { code, providerMessage: 'synthetic private response' }
  reportSearchOutcome({ kind: 'failure', error })
  expect(report).toHaveBeenCalledExactlyOnceWith(expected)
})

it('취소된 결과와 일반 조회 성공은 오류로 기록하지 않는다', () => {
  reportSearchOutcome(null)
  reportSearchOutcome({ kind: 'success', rows: [] })
  expect(report).not.toHaveBeenCalled()
})

it('최고 명성 선택은 파티 얼굴과 공대 행 값 중 확인하지 못한 쪽의 진단 코드를 남긴다', () => {
  const outcome = {
    kind: 'success',
    rows: [],
    selected: { selectionMethod: 'highest-fame' }
  } as unknown as Parameters<typeof reportSearchOutcome>[0]

  reportSearchOutcome(outcome)
  reportSearchOutcome(outcome, 'raid')

  expect(report.mock.calls).toEqual([['SEARCH_APPEARANCE_FALLBACK'], ['SEARCH_RAID_ROW_FALLBACK']])
})

it('공대 행 값으로 고른 선택은 대체 선택으로 기록하지 않는다', () => {
  for (const selectionMethod of ['job', 'fame']) {
    reportSearchOutcome(
      {
        kind: 'success',
        rows: [],
        selected: { selectionMethod }
      } as unknown as Parameters<typeof reportSearchOutcome>[0],
      'raid'
    )
  }

  expect(report).not.toHaveBeenCalled()
})

import { reportDiagnostic } from '../diagnostics/log'
import type { SearchOutcome } from './request'

/** 완료한 요청의 고정 상태만 기록하고 이름, 응답 본문과 요청 식별자는 남기지 않는다. */
export function reportSearchOutcome(outcome: SearchOutcome): void {
  if (outcome === null) {
    return
  }

  if (outcome.kind === 'success') {
    if (outcome.selected?.selectionMethod === 'highest-fame') {
      reportDiagnostic('SEARCH_APPEARANCE_FALLBACK')
    }

    return
  }
  switch (outcome.error.code) {
    case 'SEARCH_TIMEOUT':
    case 'NEOPLE_TIMEOUT':
      reportDiagnostic('SEARCH_TIMEOUT')
      break
    case 'SEARCH_RESPONSE_INVALID':
      reportDiagnostic('SEARCH_RESPONSE_INVALID')
      break
    case 'NEOPLE_UNAVAILABLE':
    case 'SEARCH_NETWORK_ERROR':
      reportDiagnostic('SEARCH_UNAVAILABLE')
      break
    default:
      reportDiagnostic('SEARCH_FAILED')
  }
}

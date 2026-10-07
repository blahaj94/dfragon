import type { AuthClock } from '../auth/types'
import type { CharacterSearchRow } from '../../preload/common/types/search'
import type { SearchHttp } from './http'
import { runSearchOperation, type SearchOperationFailure } from './operation'

export type SearchRuntime = { http: SearchHttp; clock: AuthClock }
export type SearchOutcome =
  { kind: 'success'; rows: readonly CharacterSearchRow[] } | SearchOperationFailure | null

type RequestInput = {
  runtime: SearchRuntime
  nickname: string
  startedAt: number
  signal: AbortSignal
  isCurrent: () => boolean
}

/** 기존 일반 검색을 공통 요청 예산으로 실행하고 기존 rows 응답을 유지한다. */
export async function runSearchRequest(input: RequestInput): Promise<SearchOutcome> {
  const outcome = await runSearchOperation(
    {
      clock: input.runtime.clock,
      startedAt: input.startedAt,
      signal: input.signal,
      isCurrent: input.isCurrent
    },
    (signal) => input.runtime.http({ nickname: input.nickname, signal })
  )
  if (outcome === null || outcome.kind === 'failure') {
    return outcome
  }

  return { kind: 'success', rows: outcome.value }
}

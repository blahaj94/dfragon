import type { AuthClock } from '../auth/types'
import type {
  CharacterSearchRow,
  SearchError,
  SearchErrorCode
} from '../../preload/common/types/search'
import { SearchHttpFailure, type SearchHttp } from './http'

export type SearchRuntime = { http: SearchHttp; clock: AuthClock }
export type SearchOutcome =
  | { kind: 'success'; rows: readonly CharacterSearchRow[] }
  | { kind: 'failure'; error: SearchError; retryAfterReceivedAt: number | null }
  | null

type RequestInput = {
  runtime: SearchRuntime
  nickname: string
  startedAt: number
  signal: AbortSignal
  isCurrent: () => boolean
}
type Check = { active: true } | { active: false; result: SearchOutcome }

function failure(code: SearchErrorCode): SearchOutcome {
  return { kind: 'failure', error: { code, retryAfterSeconds: null }, retryAfterReceivedAt: null }
}

export async function runSearchRequest(input: RequestInput): Promise<SearchOutcome> {
  const { runtime, signal } = input
  const deadline = input.startedAt + 15_000
  const transport = new AbortController()
  let finishInterrupted!: (result: SearchOutcome) => void
  const interrupted = new Promise<SearchOutcome>((resolve) => {
    finishInterrupted = resolve
  })
  let cancelDeadline = (): void => undefined
  let finished = false

  function check(): Check {
    const isCurrent = input.isCurrent()
    const canContinue = !signal.aborted && isCurrent
    if (!canContinue) {
      return { active: false, result: null }
    }
    const isExpired = runtime.clock.read().monotonicMs >= deadline
    if (isExpired) {
      return { active: false, result: failure('SEARCH_TIMEOUT') }
    }
    return { active: true }
  }

  function cancel(): void {
    transport.abort()
    finishInterrupted(null)
  }

  function expire(): void {
    if (finished) {
      return
    }
    const current = check()
    if (current.active) {
      const remaining = deadline - runtime.clock.read().monotonicMs
      cancelDeadline = runtime.clock.schedule(Math.max(1, remaining), expire)
      return
    }
    transport.abort()
    finishInterrupted(current.result)
  }

  async function perform(): Promise<SearchOutcome> {
    const beforeHttp = check()
    if (!beforeHttp.active) {
      return beforeHttp.result
    }

    try {
      const rows = await runtime.http({
        nickname: input.nickname,
        signal: transport.signal
      })
      const completed = check()
      return completed.active ? { kind: 'success', rows } : completed.result
    } catch (error) {
      const completed = check()
      if (!completed.active) {
        return completed.result
      }
      const isSearchFailure = error instanceof SearchHttpFailure
      if (!isSearchFailure) {
        return failure('SEARCH_NETWORK_ERROR')
      }
      return {
        kind: 'failure',
        error: { code: error.code, retryAfterSeconds: error.retryAfterSeconds },
        retryAfterReceivedAt: error.retryAfterReceivedAt
      }
    }
  }

  const initial = check()
  if (!initial.active) {
    return initial.result
  }
  signal.addEventListener('abort', cancel, { once: true })
  const remaining = deadline - runtime.clock.read().monotonicMs
  cancelDeadline = runtime.clock.schedule(Math.max(0, remaining), expire)
  try {
    return await Promise.race([perform(), interrupted])
  } finally {
    finished = true
    cancelDeadline()
    signal.removeEventListener('abort', cancel)
  }
}

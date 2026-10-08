import type { AuthClock } from '../auth/types'
import type { SearchError, SearchErrorCode } from '../../preload/common/types/search'
import { SearchHttpFailure } from './http'

const SEARCH_OPERATION_TIMEOUT_MS = 15_000

export type SearchOperationFailure = {
  kind: 'failure'
  error: SearchError
  retryAfterReceivedAt: number | null
}
export type SearchOperationOutcome<T> =
  | { kind: 'success'; value: T }
  | SearchOperationFailure
  | null
export type SearchOperationContext = {
  clock: AuthClock
  startedAt: number
  signal: AbortSignal
  isCurrent: () => boolean
}
export type SearchOperation = {
  run: <T>(step: (signal: AbortSignal) => Promise<T>) => Promise<T>
}
type Check = { active: true } | { active: false; result: SearchOperationFailure | null }

function failure(code: SearchErrorCode): SearchOperationFailure {
  return { kind: 'failure', error: { code, retryAfterSeconds: null }, retryAfterReceivedAt: null }
}

/** 조회와 후속 이미지 비교를 처음 접수한 시각부터 하나의 취소 신호와 시간 예산으로 실행한다. */
export async function runSearchOperation<T>(
  input: SearchOperationContext,
  operation: (execution: SearchOperation) => Promise<T>
): Promise<SearchOperationOutcome<T>> {
  const { clock, signal } = input
  const deadline = input.startedAt + SEARCH_OPERATION_TIMEOUT_MS
  const transport = new AbortController()
  let finishInterrupted!: (result: SearchOperationFailure | null) => void
  const interrupted = new Promise<SearchOperationFailure | null>((resolve) => {
    finishInterrupted = resolve
  })
  let cancelDeadline = (): void => undefined
  let finished = false

  function check(): Check {
    if (signal.aborted || !input.isCurrent()) {
      return { active: false, result: null }
    }

    if (clock.read().monotonicMs >= deadline) {
      const result = failure('SEARCH_TIMEOUT')

      return { active: false, result }
    }

    return { active: true }
  }

  function cancel(): void {
    transport.abort()
    finishInterrupted(null)
  }

  function assertActive(): void {
    if (!check().active) {
      transport.abort()
      transport.signal.throwIfAborted()
    }
  }

  async function runStep<Value>(step: (signal: AbortSignal) => Promise<Value>): Promise<Value> {
    assertActive()
    try {
      const value = await step(transport.signal)
      assertActive()

      return value
    } catch (error) {
      // 취소를 무시한 의존성이나 늦게 실행된 타이머도 다음 업무 단계로 진행하지 못하게 한다.
      assertActive()
      throw error
    }
  }

  function expire(): void {
    if (finished) {
      return
    }
    const current = check()
    if (current.active) {
      const remaining = deadline - clock.read().monotonicMs
      cancelDeadline = clock.schedule(Math.max(1, remaining), expire)

      return
    }
    transport.abort()
    finishInterrupted(current.result)
  }

  async function perform(): Promise<SearchOperationOutcome<T>> {
    const before = check()
    if (!before.active) {
      return before.result
    }

    try {
      const value = await operation({ run: runStep })
      const completed = check()
      if (completed.active) {
        return { kind: 'success', value }
      }

      return completed.result
    } catch (error) {
      const completed = check()
      if (!completed.active) {
        return completed.result
      }

      if (!(error instanceof SearchHttpFailure)) {
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
  const remaining = deadline - clock.read().monotonicMs
  cancelDeadline = clock.schedule(Math.max(0, remaining), expire)
  try {
    return await Promise.race([perform(), interrupted])
  } finally {
    finished = true
    cancelDeadline()
    signal.removeEventListener('abort', cancel)
  }
}

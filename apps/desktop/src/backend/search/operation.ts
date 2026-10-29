import type { SearchError, SearchErrorCode } from '../../preload/common/types/search'
import { SearchHttpFailure } from './http'

export type SearchOperationFailure = {
  kind: 'failure'
  error: SearchError
}
export type SearchOperationOutcome<T> =
  | { kind: 'success'; value: T }
  | SearchOperationFailure
  | null
export type SearchOperationContext = {
  signal: AbortSignal
  isCurrent: () => boolean
}
export type SearchOperation = {
  run: <T>(step: (signal: AbortSignal) => Promise<T>) => Promise<T>
}

function failure(code: SearchErrorCode): SearchOperationFailure {
  return { kind: 'failure', error: { code } }
}

export async function runSearchOperation<T>(
  input: SearchOperationContext,
  operation: (execution: SearchOperation) => Promise<T>
): Promise<SearchOperationOutcome<T>> {
  const { signal } = input
  const transport = new AbortController()

  function isActive(): boolean {
    return !signal.aborted && input.isCurrent()
  }

  function cancel(): void {
    transport.abort()
  }

  function assertActive(): void {
    if (!isActive()) {
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
      // 취소를 무시한 의존성도 다음 업무 단계로 진행하지 못하게 한다.
      assertActive()
      throw error
    }
  }

  if (!isActive()) {
    return null
  }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    const value = await operation({ run: runStep })
    // 취소나 새 요청 뒤에 끝난 결과는 성공이든 실패든 발행하지 않는다.
    if (!isActive()) {
      return null
    }

    return { kind: 'success', value }
  } catch (error) {
    if (!isActive()) {
      return null
    }

    if (!(error instanceof SearchHttpFailure)) {
      return failure('SEARCH_NETWORK_ERROR')
    }

    return failure(error.code)
  } finally {
    signal.removeEventListener('abort', cancel)
  }
}

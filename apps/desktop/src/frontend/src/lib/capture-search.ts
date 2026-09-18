import { createActor } from 'xstate'
import type { SearchView } from '../types/search'
import { emptySearchSlots } from './slots'
import { SEARCH_ACTIONS } from '../../../preload/common/types/search'
import {
  SEARCH_ERRORS,
  type SearchApi,
  type SearchObservation,
  type SearchCommandResult,
  type SearchSlot,
  type SearchSnapshot
} from '../../../preload/common/types/search'
import { createSearchConnection } from './search-connection'
import { captureSearchMachine } from './capture-search-machine'

type SearchOptions = {
  api: SearchApi
  notify: (observation: SearchObservation) => Promise<SearchCommandResult>
  onChange: (view: SearchView) => void
  onInvalidated: () => void
}

export type CaptureSearch = {
  connect: () => void
  begin: (input: { signal: AbortSignal }) => Promise<string | null>
  end: () => void
  observe: (input: { slot: number; nickname: string | null }) => void
  retry: (slotIndex: number) => Promise<void>
  dispose: () => void
}

/** 호출마다 독립된 검색 연결·actor·관측 상태를 만들고 수명 제어 함수를 반환한다. */
export function createCaptureSearch(options: SearchOptions): CaptureSearch {
  let revisions = [0, 0, 0, 0]
  let cleared = [true, true, true, true]
  let snapshot: SearchSnapshot | null = null
  const pending = new Map<number, string>()
  let failed = false

  const connection = createSearchConnection({
    api: options.api,
    onSnapshot: (snapshot) => accept(snapshot),
    onFailure: () => {
      failed = true
      publish()
    },
    onRunChanged: () => lifetime.send({ type: 'INVALIDATE' })
  })
  const lifetime = createActor(captureSearchMachine, {
    input: {
      command: (control) => connection.command(control),
      readSnapshot: () => snapshot,
      resetObservations: () => {
        revisions = [0, 0, 0, 0]
        cleared = [true, true, true, true]
        pending.clear()
      }
    }
  }).start()
  lifetime.subscribe((state) => {
    if (state.matches('invalidated')) {
      options.onInvalidated()
    }
    publish()
  })

  // 구독과 초기 조회를 시작한다.
  function connect(): void {
    connection.connect()
  }

  // 연결이 준비된 경우 시작 actor에 요청하고 해당 요청의 결과를 반환한다.
  async function begin({ signal }: { signal: AbortSignal }): Promise<string | null> {
    if (!connection.isReady() || lifetime.getSnapshot().status !== 'active') {
      return null
    }
    const { promise, resolve, reject } = Promise.withResolvers<string | null>()
    lifetime.send({ type: 'BEGIN', signal, resolve, reject })
    return promise
  }

  // 현재 시작 또는 실행 수명을 종료한다.
  function end(): void {
    if (lifetime.getSnapshot().status === 'active') {
      lifetime.send({ type: 'END' })
    }
  }

  // 로컬 관측을 먼저 표시한 뒤 clear 또는 검색 통지를 보낸다.
  function observe({ slot, nickname }: { slot: number; nickname: string | null }): void {
    const captureId = lifetime.getSnapshot().context.captureId
    if (captureId == null) {
      return
    }
    revisions[slot] += 1
    const isClear = nickname === null
    cleared[slot] = isClear
    pending.delete(slot)
    const observationRevision = revisions[slot]
    publish()
    if (isClear) {
      void connection.command({
        action: SEARCH_ACTIONS.CLEAR,
        captureId,
        slot,
        observationRevision
      })
    } else {
      void connection.invoke(() =>
        options.notify({ captureId, slot, observationRevision, nickname })
      )
    }
  }

  // 현재 슬롯의 수동 재시도 가능 여부와 중복 요청을 검사한다.
  async function retry(slotIndex: number): Promise<void> {
    const captureId = lifetime.getSnapshot().context.captureId
    const slot = getVisibleSearchSlots({ captureId, snapshot, revisions, cleared })[slotIndex]
    const error = slot.error
    const isFailureState = slot.state === 'failure'
    const hasError = error != null
    const hasFailure = isFailureState && hasError
    const hasCaptureId = captureId != null
    const hasRequestId = slot.requestId != null
    const hasId = hasCaptureId && hasRequestId
    const isPending = pending.has(slotIndex)
    const canConsiderRetry = hasFailure && hasId && !isPending
    if (!canConsiderRetry) {
      return
    }
    const isRetryable = SEARCH_ERRORS[error.code].retryable
    const isRateLimit = error.code === 'SEARCH_RATE_LIMITED'
    let canRetry = isRetryable
    if (isRateLimit) {
      const hasRetryAfter = error.retryAfterSeconds != null
      if (hasRetryAfter) {
        const hasPositiveRetryAfter = error.retryAfterSeconds > 0
        const isWaiting = hasPositiveRetryAfter
        canRetry = isRetryable && !isWaiting
      }
    }
    if (!canRetry) {
      return
    }
    const requestId = slot.requestId
    pending.set(slotIndex, requestId)
    publish()
    await connection.command({
      action: SEARCH_ACTIONS.RETRY,
      captureId,
      slot: slotIndex,
      requestId
    })
    const isSameRequest = pending.get(slotIndex) === requestId
    if (isSameRequest) {
      pending.delete(slotIndex)
      publish()
    }
  }

  // 캡처 수명을 종료한 다음 연결 구독을 해제한다.
  function dispose(): void {
    if (lifetime.getSnapshot().status === 'active') {
      lifetime.send({ type: 'DISPOSE' })
    }
    connection.dispose()
  }

  // main snapshot을 반영하고 종료된 캡처의 로컬 수명을 무효화한다.
  function accept(next: SearchSnapshot | null): void {
    snapshot = next
    const hasSnapshot = next != null
    if (hasSnapshot) {
      failed = false
    }
    const hasActiveId = lifetime.getSnapshot().context.captureId != null
    if (hasSnapshot) {
      const hasEnded = next.captureId === null
      const isInvalidated = hasActiveId && hasEnded
      if (isInvalidated) {
        lifetime.send({ type: 'INVALIDATE' })
      }
    }
    publish()
  }

  // 현재 연결·actor·관측 상태로 화면용 값을 만들어 전달한다.
  function publish(): void {
    options.onChange({
      ready: connection.isReady(),
      captureActive: lifetime.getSnapshot().matches('active'),
      slots: getVisibleSearchSlots({
        captureId: lifetime.getSnapshot().context.captureId,
        snapshot,
        revisions,
        cleared
      }),
      retryPending: Array.from({ length: 4 }, (_, slot) => {
        const isPending = pending.has(slot)
        return isPending
      }),
      connectionFailed: failed
    })
  }

  return { connect, begin, end, observe, retry, dispose }
}

/** 현재 캡처와 로컬 관측 이후의 슬롯만 반환하며 입력 상태를 변경하지 않는다. */
function getVisibleSearchSlots({
  captureId,
  snapshot,
  revisions,
  cleared
}: {
  captureId: string | null
  snapshot: SearchSnapshot | null
  revisions: readonly number[]
  cleared: readonly boolean[]
}): readonly SearchSlot[] {
  if (captureId == null) {
    return emptySearchSlots()
  }
  const hasSnapshot = snapshot != null
  if (!hasSnapshot) {
    return emptySearchSlots()
  }
  const hasSameCapture = captureId === snapshot.captureId
  if (!hasSameCapture) {
    return emptySearchSlots()
  }
  const empty = emptySearchSlots()
  return snapshot.slots.map((slot) => {
    const observedRevision = revisions[slot.slot]
    const hasObserved = observedRevision > 0
    const isCurrent = slot.observationRevision >= observedRevision
    const isIdle = slot.state === 'idle'
    const isCleared = cleared[slot.slot]
    const canShow = isCurrent && (isIdle || (hasObserved && !isCleared))
    return canShow ? slot : empty[slot.slot]
  })
}

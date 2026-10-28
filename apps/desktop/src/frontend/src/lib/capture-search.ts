import { createActor } from 'xstate'
import type { SearchView } from '../types/search'
import { emptySearchSlots } from './slots'
import { SEARCH_ACTIONS, SEARCH_SLOT_COUNTS } from '../../../preload/common/types/search'
import {
  SEARCH_ERRORS,
  type SearchApi,
  type OcrSearchInput,
  type OcrSearchObservation,
  type SearchCommandResult,
  type SearchSlot,
  type SearchSlotCount,
  type SearchSnapshot
} from '../../../preload/common/types/search'
import { createSearchConnection } from './search-connection'
import { captureSearchMachine } from './capture-search-machine'

type SearchOptions = {
  api: SearchApi
  notifyOcr?: (observation: OcrSearchObservation) => Promise<SearchCommandResult>
  onChange: (view: SearchView) => void
  onInvalidated: () => void
  slotCount?: SearchSlotCount
}

export type OcrCaptureObservation = OcrSearchInput & Readonly<{ slot: number; nickname: string }>

export type CaptureSearch = {
  connect: () => void
  begin: (input: { signal: AbortSignal }) => Promise<string | null>
  end: () => void
  observe: (input: OcrCaptureObservation) => void
  lookup: (input: { slot: number; nickname: string; serverId: string }) => void
  retry: (slotIndex: number) => Promise<void>
  dispose: () => void
}

export function createCaptureSearch(options: SearchOptions): CaptureSearch {
  const slotCount = options.slotCount ?? SEARCH_SLOT_COUNTS.party
  let revisions = Array.from({ length: slotCount }, () => 0)
  let snapshot: SearchSnapshot | null = null
  const pending = new Map<number, string>()
  let failed = false

  const connection = createSearchConnection({
    api: options.api,
    slotCount,
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
        revisions = Array.from({ length: slotCount }, () => 0)
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

  function connect(): void {
    connection.connect()
  }

  async function begin({ signal }: { signal: AbortSignal }): Promise<string | null> {
    if (!connection.isReady() || lifetime.getSnapshot().status !== 'active') {
      return null
    }
    const { promise, resolve, reject } = Promise.withResolvers<string | null>()
    lifetime.send({ type: 'BEGIN', signal, resolve, reject })

    return promise
  }

  function end(): void {
    if (lifetime.getSnapshot().status === 'active') {
      lifetime.send({ type: 'END' })
    }
  }

  // 로컬 관측을 먼저 표시한 뒤 OCR 후보 통지를 보낸다.
  function observe(input: OcrCaptureObservation): void {
    const { slot } = input
    const captureId = lifetime.getSnapshot().context.captureId
    if (captureId == null) {
      return
    }
    revisions[slot] += 1
    pending.delete(slot)
    const observationRevision = revisions[slot]
    publish()
    const notifyOcr = options.notifyOcr
    if (notifyOcr == null) {
      failed = true
      publish()

      return
    }
    connection.invoke(() => notifyOcr({ ...input, captureId, observationRevision }))
  }

  function lookup(input: { slot: number; nickname: string; serverId: string }): void {
    const captureId = lifetime.getSnapshot().context.captureId
    if (captureId === null) {
      return
    }
    revisions[input.slot] += 1
    pending.delete(input.slot)
    const observationRevision = revisions[input.slot]
    publish()
    connection.command({
      action: SEARCH_ACTIONS.LOOKUP,
      captureId,
      observationRevision,
      ...input
    })
  }

  async function retry(slotIndex: number): Promise<void> {
    const captureId = lifetime.getSnapshot().context.captureId
    const slot = getVisibleSearchSlots({ captureId, snapshot, revisions, slotCount })[slotIndex]
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

  function publish(): void {
    options.onChange({
      ready: connection.isReady(),
      captureActive: lifetime.getSnapshot().matches('active'),
      slots: getVisibleSearchSlots({
        captureId: lifetime.getSnapshot().context.captureId,
        snapshot,
        revisions,
        slotCount
      }),
      retryPending: Array.from({ length: slotCount }, (_, slot) => {
        const isPending = pending.has(slot)

        return isPending
      }),
      connectionFailed: failed
    })
  }

  return { connect, begin, end, observe, lookup, retry, dispose }
}

function getVisibleSearchSlots({
  captureId,
  snapshot,
  revisions,
  slotCount
}: {
  captureId: string | null
  snapshot: SearchSnapshot | null
  revisions: readonly number[]
  slotCount: SearchSlotCount
}): readonly SearchSlot[] {
  if (captureId == null) {
    return emptySearchSlots(slotCount)
  }
  const hasSnapshot = snapshot != null
  if (!hasSnapshot) {
    return emptySearchSlots(slotCount)
  }
  const hasSameCapture = captureId === snapshot.captureId
  if (!hasSameCapture) {
    return emptySearchSlots(slotCount)
  }
  const empty = emptySearchSlots(slotCount)

  return snapshot.slots.map((slot) => {
    const observedRevision = revisions[slot.slot]
    const hasObserved = observedRevision > 0
    const isCurrent = slot.observationRevision >= observedRevision
    const isIdle = slot.state === 'idle'
    const canShow = isCurrent && (isIdle || hasObserved)
    if (canShow) {
      return slot
    }

    return empty[slot.slot]
  })
}

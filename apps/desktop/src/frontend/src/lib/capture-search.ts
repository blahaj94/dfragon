import { createActor, type ActorRefFrom } from 'xstate'
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
import { SearchConnection } from './search-connection'
import { captureSearchMachine } from './capture-search-machine'

type SearchOptions = {
  api: SearchApi
  notify: (observation: SearchObservation) => Promise<SearchCommandResult>
  onChange: (view: SearchView) => void
  onInvalidated: () => void
}

/** 캡처별 검색 수명과 슬롯 관측·재시도를 관리하고 화면에 전달할 검색 상태를 만든다. */
export class CaptureSearch {
  private readonly connection: SearchConnection
  private readonly lifetime: ActorRefFrom<typeof captureSearchMachine>
  private revisions = [0, 0, 0, 0]
  private cleared = [true, true, true, true]
  private snapshot: SearchSnapshot | null = null
  private pending = new Map<number, string>()
  private failed = false

  constructor(private readonly options: SearchOptions) {
    this.connection = new SearchConnection({
      api: options.api,
      onSnapshot: (snapshot) => this.accept(snapshot),
      onFailure: () => {
        this.failed = true
        this.publish()
      },
      onRunChanged: () => this.lifetime.send({ type: 'INVALIDATE' })
    })
    this.lifetime = createActor(captureSearchMachine, {
      input: {
        command: (control) => this.connection.command(control),
        readSnapshot: () => this.snapshot,
        resetObservations: () => {
          this.revisions = [0, 0, 0, 0]
          this.cleared = [true, true, true, true]
          this.pending.clear()
        }
      }
    }).start()
    this.lifetime.subscribe((state) => {
      if (state.matches('invalidated')) {
        this.options.onInvalidated()
      }
      this.publish()
    })
  }

  connect(): void {
    this.connection.connect()
  }

  async begin({ signal }: { signal: AbortSignal }): Promise<string | null> {
    if (!this.connection.ready || this.lifetime.getSnapshot().status !== 'active') {
      return null
    }
    const { promise, resolve, reject } = Promise.withResolvers<string | null>()
    this.lifetime.send({ type: 'BEGIN', signal, resolve, reject })
    return promise
  }

  end(): void {
    if (this.lifetime.getSnapshot().status === 'active') {
      this.lifetime.send({ type: 'END' })
    }
  }

  observe({ slot, nickname }: { slot: number; nickname: string | null }): void {
    const captureId = this.lifetime.getSnapshot().context.captureId
    if (captureId == null) {
      return
    }
    this.revisions[slot] += 1
    const isClear = nickname === null
    this.cleared[slot] = isClear
    this.pending.delete(slot)
    const observationRevision = this.revisions[slot]
    this.publish()
    if (isClear) {
      void this.connection.command({
        action: SEARCH_ACTIONS.CLEAR,
        captureId,
        slot,
        observationRevision
      })
    } else {
      void this.connection.invoke(() =>
        this.options.notify({ captureId, slot, observationRevision, nickname })
      )
    }
  }

  async retry(slotIndex: number): Promise<void> {
    const captureId = this.lifetime.getSnapshot().context.captureId
    const slot = this.visibleSlots()[slotIndex]
    const error = slot.error
    const isFailureState = slot.state === 'failure'
    const hasError = error != null
    const hasFailure = isFailureState && hasError
    const hasCaptureId = captureId != null
    const hasRequestId = slot.requestId != null
    const hasId = hasCaptureId && hasRequestId
    const isPending = this.pending.has(slotIndex)
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
    this.pending.set(slotIndex, requestId)
    this.publish()
    await this.connection.command({
      action: SEARCH_ACTIONS.RETRY,
      captureId,
      slot: slotIndex,
      requestId
    })
    const isSameRequest = this.pending.get(slotIndex) === requestId
    if (isSameRequest) {
      this.pending.delete(slotIndex)
      this.publish()
    }
  }

  dispose(): void {
    if (this.lifetime.getSnapshot().status === 'active') {
      this.lifetime.send({ type: 'DISPOSE' })
    }
    this.connection.dispose()
  }

  private accept(snapshot: SearchSnapshot | null): void {
    this.snapshot = snapshot
    const hasSnapshot = snapshot != null
    if (hasSnapshot) {
      this.failed = false
    }
    const hasActiveId = this.lifetime.getSnapshot().context.captureId != null
    if (hasSnapshot) {
      const hasEnded = snapshot.captureId === null
      const isInvalidated = hasActiveId && hasEnded
      if (isInvalidated) {
        this.lifetime.send({ type: 'INVALIDATE' })
      }
    }
    this.publish()
  }

  private visibleSlots(): readonly SearchSlot[] {
    const captureId = this.lifetime.getSnapshot().context.captureId
    const snapshot = this.snapshot
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
      const observedRevision = this.revisions[slot.slot]
      const hasObserved = observedRevision > 0
      const isCurrent = slot.observationRevision >= observedRevision
      const isIdle = slot.state === 'idle'
      const isCleared = this.cleared[slot.slot]
      const canShow = isCurrent && (isIdle || (hasObserved && !isCleared))
      return canShow ? slot : empty[slot.slot]
    })
  }

  private publish(): void {
    this.options.onChange({
      ready: this.connection.ready,
      captureActive: this.lifetime.getSnapshot().matches('active'),
      slots: this.visibleSlots(),
      retryPending: Array.from({ length: 4 }, (_, slot) => {
        const isPending = this.pending.has(slot)
        return isPending
      }),
      connectionFailed: this.failed
    })
  }
}

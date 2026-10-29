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
    onSnapshot: (snapshot) => accept(snapshot),
    onFailure: () => {
      failed = true
      publish()
    }
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
    if (
      captureId == null ||
      slot.requestId == null ||
      slot.state !== 'failure' ||
      error == null ||
      pending.has(slotIndex) ||
      !SEARCH_ERRORS[error.code].retryable
    ) {
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
    if (pending.get(slotIndex) === requestId) {
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
    if (next != null) {
      failed = false
      if (endsActiveCapture(next)) {
        lifetime.send({ type: 'INVALIDATE' })
      }
    }
    publish()
  }

  function endsActiveCapture(next: SearchSnapshot): boolean {
    if (lifetime.getSnapshot().context.captureId == null) {
      return false
    }

    return next.captureId === null
  }

  function publish(): void {
    options.onChange({
      ready: connection.isReady(),
      slots: getVisibleSearchSlots({
        captureId: lifetime.getSnapshot().context.captureId,
        snapshot,
        revisions,
        slotCount
      }),
      retryPending: Array.from({ length: slotCount }, (_, slot) => pending.has(slot)),
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
  if (captureId == null || snapshot?.captureId !== captureId) {
    return emptySearchSlots(slotCount)
  }
  const empty = emptySearchSlots(slotCount)

  return snapshot.slots.map((slot) => {
    if (canShowSlot(slot, revisions[slot.slot])) {
      return slot
    }

    return empty[slot.slot]
  })
}

function canShowSlot(slot: SearchSlot, observedRevision: number): boolean {
  if (slot.observationRevision < observedRevision) {
    return false
  }

  return slot.state === 'idle' || observedRevision > 0
}

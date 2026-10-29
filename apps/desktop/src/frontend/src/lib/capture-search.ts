import { createActor } from 'xstate'
import type { SearchView } from '../types/search'
import { emptySearchSlots, fillSlots } from './slots'
import { SEARCH_ACTIONS } from '../../../preload/common/types/search'
import type {
  SearchApi,
  OcrSearchInput,
  OcrSearchObservation,
  SearchCommandResult,
  SearchSlot,
  SearchSlotCount,
  SearchSnapshot
} from '../../../preload/common/types/search'
import { createSearchConnection } from './search-connection'
import { captureSearchMachine } from './capture-search-machine'

type SearchOptions = {
  api: SearchApi
  notifyOcr: (observation: OcrSearchObservation) => Promise<SearchCommandResult>
  onChange: (view: SearchView) => void
  onInvalidated: () => void
  slotCount: SearchSlotCount
}

type LookupInput = { slot: number; nickname: string; serverId: string }

type LifetimeStart = { captureId: Promise<string | null>; controller: AbortController }

export type OcrCaptureObservation = OcrSearchInput & Readonly<{ slot: number; nickname: string }>

export type CaptureSearch = {
  connect: () => void
  begin: (input: { signal: AbortSignal }) => Promise<string | null>
  end: () => void
  observe: (input: OcrCaptureObservation) => void
  lookup: (input: LookupInput) => void
  dispose: () => void
}

export function createCaptureSearch(options: SearchOptions): CaptureSearch {
  const { slotCount } = options
  let revisions = fillSlots(slotCount, 0)
  let manualSlots: readonly boolean[] = fillSlots(slotCount, false)
  let reusableLifetimeStart: LifetimeStart | null = null
  const waitingLookups = new Map<number, LookupInput>()
  let snapshot: SearchSnapshot | null = null
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
        revisions = fillSlots(slotCount, 0)
      }
    }
  }).start()
  lifetime.subscribe((state) => {
    if (state.matches('invalidated')) {
      cancelStartAndWaitingLookups()
      options.onInvalidated()
    }
    publish()
  })

  function connect(): void {
    connection.connect()
  }

  // 캡처 회차는 수명을 새로 시작해 모든 슬롯을 비우고, 그 뒤의 서버 지정 조회도 회차의 수명을 쓴다. 회차가
  // 취소되거나 시작에 실패하면 그 시작을 버리고 다음 조회가 수명을 다시 시작한다.
  function begin({ signal }: { signal: AbortSignal }): Promise<string | null> {
    manualSlots = fillSlots(slotCount, false)
    cancelStartAndWaitingLookups()
    const current = startLifetime()
    reusableLifetimeStart = current
    publish()
    signal.addEventListener(
      'abort',
      () => {
        if (reusableLifetimeStart === current) {
          cancelStartAndWaitingLookups()
          publish()
        }
      },
      { once: true }
    )
    current.captureId.then(
      (captureId) => {
        if (captureId === null) {
          forgetFailedStart(current)
        }
      },
      () => forgetFailedStart(current)
    )

    return current.captureId
  }

  // 시작을 기다리던 조회가 있으면 그 조회가 연결 실패를 알리고 시작을 버려야 하므로 여기서는 버리지 않는다. 이
  // 처리는 begin에서 먼저 등록돼 기다리던 조회의 처리보다 먼저 실행된다.
  function forgetFailedStart(start: LifetimeStart): void {
    if (reusableLifetimeStart === start && waitingLookups.size === 0) {
      reusableLifetimeStart = null
    }
  }

  function startLifetime(): LifetimeStart {
    const controller = new AbortController()

    return { captureId: requestLifetime(controller.signal), controller }
  }

  async function requestLifetime(signal: AbortSignal): Promise<string | null> {
    if (!connection.isReady() || lifetime.getSnapshot().status !== 'active') {
      return null
    }
    const { promise, resolve, reject } = Promise.withResolvers<string | null>()
    lifetime.send({ type: 'BEGIN', signal, resolve, reject })

    return promise
  }

  function end(): void {
    manualSlots = fillSlots(slotCount, false)
    cancelStartAndWaitingLookups()
    endLifetime()
  }

  function endLifetime(): void {
    if (lifetime.getSnapshot().status === 'active') {
      lifetime.send({ type: 'END' })
    }
  }

  // 시작 중인 수명을 끊어 두어야, 연결이 준비되지 않아 새 begin이 수명을 시작하지 못해도 그 시작이 늦게 만든
  // capture를 main에서 끝낸다.
  function cancelStartAndWaitingLookups(): void {
    reusableLifetimeStart?.controller.abort()
    reusableLifetimeStart = null
    waitingLookups.clear()
  }

  // 로컬 관측을 먼저 표시한 뒤 OCR 후보 통지를 보낸다. 사용자가 직접 조회한 슬롯은 회차의 OCR 결과로 덮지 않는다.
  function observe(input: OcrCaptureObservation): void {
    const { slot } = input
    const captureId = lifetime.getSnapshot().context.captureId
    if (manualSlots[slot] || captureId == null) {
      return
    }
    revisions[slot] += 1
    const observationRevision = revisions[slot]
    publish()
    connection.invoke(() => options.notifyOcr({ ...input, captureId, observationRevision }))
  }

  function lookup(input: LookupInput): void {
    const { slot } = input
    manualSlots = manualSlots.map((manual, index) => manual || index === slot)
    reusableLifetimeStart ??= startLifetime()
    const current = reusableLifetimeStart
    waitingLookups.set(slot, input)
    publish()
    current.captureId
      .then((captureId) => {
        if (reusableLifetimeStart !== current || waitingLookups.get(slot) !== input) {
          return
        }

        if (captureId === null) {
          failStart()

          return
        }
        waitingLookups.delete(slot)
        sendLookup(input)
      })
      .catch(() => {
        if (reusableLifetimeStart === current) {
          failStart()
        }
      })
  }

  function sendLookup(input: LookupInput): void {
    const captureId = lifetime.getSnapshot().context.captureId
    if (captureId === null) {
      return
    }
    revisions[input.slot] += 1
    const observationRevision = revisions[input.slot]
    publish()
    connection.command({
      action: SEARCH_ACTIONS.LOOKUP,
      captureId,
      observationRevision,
      ...input
    })
  }

  function failStart(): void {
    cancelStartAndWaitingLookups()
    endLifetime()
    // 연결이 끊긴 것(failed)과 달리 이 시작만 실패한 것이라, 다음 표시 갱신까지만 연결 실패로 알린다.
    options.onChange({ ...searchView(), connectionFailed: true })
  }

  // 캡처 수명을 종료한 다음 연결 구독을 해제한다.
  function dispose(): void {
    cancelStartAndWaitingLookups()
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

  function searchView(): SearchView {
    const visible = getVisibleSearchSlots({
      captureId: lifetime.getSnapshot().context.captureId,
      snapshot,
      revisions,
      slotCount
    })
    const slots = showWaitingLookups(visible, waitingLookups)

    return {
      ready: connection.isReady(),
      slots,
      manualSlots,
      connectionFailed: failed
    }
  }

  function publish(): void {
    options.onChange(searchView())
  }

  return { connect, begin, end, observe, lookup, dispose }
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
  const empty = emptySearchSlots(slotCount)
  if (captureId == null || snapshot?.captureId !== captureId) {
    return empty
  }

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

function showWaitingLookups(
  slots: readonly SearchSlot[],
  waiting: ReadonlyMap<number, LookupInput>
): readonly SearchSlot[] {
  return slots.map((slot) => {
    if (waiting.has(slot.slot)) {
      return { ...slot, state: 'pending' }
    }

    return slot
  })
}

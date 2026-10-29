import { createActor } from 'xstate'
import type { Actor, EventFrom, SnapshotFrom } from 'xstate'
import type {
  SearchApi,
  SearchCommandResult,
  SearchControl,
  SearchSlotCount,
  SearchSnapshot
} from '../../../preload/common/types/search'
import { parseSearchResult } from '../../../preload/common/search/snapshot'
import { readSearchSnapshot, searchConnectionMachine } from './search-connection-machine'

type ConnectionActor = Actor<typeof searchConnectionMachine>
type ConnectionState = SnapshotFrom<typeof searchConnectionMachine>

type ConnectionOptions = {
  api: SearchApi
  slotCount: SearchSlotCount
  onSnapshot: (snapshot: SearchSnapshot | null) => void
  onFailure: () => void
}

export type SearchConnection = {
  isReady: () => boolean
  connect: () => void
  command: (control: SearchControl) => Promise<SearchCommandResult | null>
  invoke: (send: () => Promise<SearchCommandResult>) => Promise<SearchCommandResult | null>
  dispose: () => void
}

export function createSearchConnection(options: ConnectionOptions): SearchConnection {
  const target = { api: options.api, slotCount: options.slotCount }
  let currentActor = createActor(searchConnectionMachine, { input: target })

  function isReady(): boolean {
    return isActive(currentActor) && currentActor.getSnapshot().hasTag('ready')
  }

  function connect(): void {
    if (currentActor.getSnapshot().status === 'stopped') {
      return
    }
    currentActor.stop()
    const actor = createActor(searchConnectionMachine, { input: target })
    currentActor = actor
    let previous: ConnectionState | undefined
    actor.subscribe((state) => {
      const changed = shouldPublishSnapshot(previous, state)
      const readFailed = isNewReadFailure(previous, state)
      previous = state
      if (changed) {
        options.onSnapshot(state.context.snapshot)
      }

      if (readFailed) {
        options.onFailure()
      }
    })
    actor.start()
  }

  async function command(control: SearchControl): Promise<SearchCommandResult | null> {
    return invoke(() => options.api.controlCharacterSearch(control))
  }

  // 호출 당시 actor에만 응답을 반영하며 유실된 명령은 조회로만 확인한다.
  async function invoke(
    send: () => Promise<SearchCommandResult>
  ): Promise<SearchCommandResult | null> {
    const actor = currentActor
    try {
      const result = parseSearchResult(await send(), options.slotCount)
      if (result == null) {
        throw new Error('Invalid search bridge response')
      }

      sendIfActive(actor, { type: 'RESULT', snapshot: result.snapshot })
      // 종료된 연결의 늦은 begin도 직접 받은 ID로 main capture를 정리해야 한다.

      return result
    } catch {
      if (isActive(actor)) {
        try {
          const snapshot = await readSearchSnapshot(target)
          sendIfActive(actor, { type: 'READ_SUCCEEDED', snapshot })
        } catch {
          sendIfActive(actor, { type: 'READ_FAILED' })
        }
      }
      // 슬롯별 명령은 병렬로 유지하며 유실된 mutation을 재전송하거나 성공으로 합성하지 않는다.

      return null
    }
  }

  // 구독, 조회 actor를 종료하되 늦은 직접 응답의 반환 경로는 유지한다.
  function dispose(): void {
    currentActor.stop()
  }

  return { isReady, connect, command, invoke, dispose }
}

function isActive(actor: ConnectionActor): boolean {
  return actor.getSnapshot().status === 'active'
}

function sendIfActive(
  actor: ConnectionActor,
  event: EventFrom<typeof searchConnectionMachine>
): void {
  if (isActive(actor)) {
    actor.send(event)
  }
}

// 실패 뒤 event가 표시를 회복했어도 다음 조회 실패는 다시 알려야 한다.
function isNewReadFailure(previous: ConnectionState | undefined, state: ConnectionState): boolean {
  if (!state.hasTag('failed') || state.context.snapshot != null) {
    return false
  }

  return previous?.context !== state.context
}

function shouldPublishSnapshot(
  previous: ConnectionState | undefined,
  state: ConnectionState
): boolean {
  if (previous == null || isNewReadFailure(previous, state)) {
    return true
  }

  if (previous.context.snapshot !== state.context.snapshot) {
    return true
  }

  return (
    previous.hasTag('ready') !== state.hasTag('ready') ||
    previous.hasTag('failed') !== state.hasTag('failed')
  )
}

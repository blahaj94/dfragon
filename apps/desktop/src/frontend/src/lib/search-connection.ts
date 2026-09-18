import { createActor } from 'xstate'
import type { SnapshotFrom } from 'xstate'
import type {
  SearchApi,
  SearchCommandResult,
  SearchControl,
  SearchSnapshot
} from '../../../preload/common/types/search'
import { parseSearchResult } from '../../../preload/common/search/snapshot'
import { readSearchSnapshot, searchConnectionMachine } from './search-connection-machine'

type ConnectionOptions = {
  api: SearchApi
  onSnapshot: (snapshot: SearchSnapshot | null) => void
  onFailure: () => void
  onRunChanged: () => void
}

export type SearchConnection = {
  isReady: () => boolean
  connect: () => void
  command: (control: SearchControl) => Promise<SearchCommandResult | null>
  invoke: (send: () => Promise<SearchCommandResult>) => Promise<SearchCommandResult | null>
  dispose: () => void
}

/** 호출별 actor를 클로저에 격리하고 연결·명령·정리 함수를 반환한다. */
export function createSearchConnection(options: ConnectionOptions): SearchConnection {
  let currentActor = createActor(searchConnectionMachine, { input: { api: options.api } })

  // 현재 actor의 동기화 상태를 호출 시점에 읽는다.
  function isReady(): boolean {
    const state = currentActor.getSnapshot()
    return state.status === 'active' && state.hasTag('ready')
  }

  // 이전 actor를 종료하고 구독·초기 조회를 새 actor에서 시작한다.
  function connect(): void {
    if (currentActor.getSnapshot().status === 'stopped') {
      return
    }
    currentActor.stop()
    const actor = createActor(searchConnectionMachine, { input: { api: options.api } })
    currentActor = actor
    let previous: SnapshotFrom<typeof searchConnectionMachine> | undefined
    actor.subscribe((state) => {
      if (state.status === 'done') {
        options.onRunChanged()
        connect()
        return
      }
      const failed = state.hasTag('failed')
      // 실패 뒤 event가 표시를 회복했어도 다음 조회 실패는 다시 알려야 한다.
      const readFailed =
        failed && state.context.snapshot == null && previous?.context !== state.context
      const changed =
        readFailed ||
        previous == null ||
        previous.context.snapshot !== state.context.snapshot ||
        previous.hasTag('ready') !== state.hasTag('ready') ||
        previous.hasTag('failed') !== failed
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

  // 제어 IPC의 직접 응답을 공통 검증·복구 경계로 전달한다.
  async function command(control: SearchControl): Promise<SearchCommandResult | null> {
    return invoke(() => options.api.controlCharacterSearch(control))
  }

  // 호출 당시 actor에만 응답을 반영하며 유실된 명령은 조회로만 확인한다.
  async function invoke(
    send: () => Promise<SearchCommandResult>
  ): Promise<SearchCommandResult | null> {
    const actor = currentActor
    try {
      const result = parseSearchResult(await send())
      if (result == null) {
        throw new Error('Invalid search bridge response')
      }
      if (actor.getSnapshot().status === 'active') {
        actor.send({ type: 'RESULT', snapshot: result.snapshot })
      }
      // 종료된 연결의 늦은 begin도 직접 받은 ID로 main capture를 정리해야 한다.
      return result
    } catch {
      if (actor.getSnapshot().status === 'active') {
        try {
          const snapshot = await readSearchSnapshot(options.api)
          if (actor.getSnapshot().status === 'active') {
            actor.send({ type: 'READ_SUCCEEDED', snapshot })
          }
        } catch {
          if (actor.getSnapshot().status === 'active') {
            actor.send({ type: 'READ_FAILED' })
          }
        }
      }
      // 슬롯별 명령은 병렬로 유지하며 유실된 mutation을 재전송하거나 성공으로 합성하지 않는다.
      return null
    }
  }

  // 구독·조회 actor를 종료하되 늦은 직접 응답의 반환 경로는 유지한다.
  function dispose(): void {
    currentActor.stop()
  }

  return { isReady, connect, command, invoke, dispose }
}

import { createActor } from 'xstate'
import type { ActorRefFrom, SnapshotFrom } from 'xstate'
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

/** 연결별 actor로 구독·조회 수명을 격리하고, 명령의 직접 응답은 호출자에게 돌려준다. */
export class SearchConnection {
  private actor: ActorRefFrom<typeof searchConnectionMachine>

  constructor(private readonly options: ConnectionOptions) {
    this.actor = createActor(searchConnectionMachine, { input: { api: options.api } })
  }

  get ready(): boolean {
    const state = this.actor.getSnapshot()
    return state.status === 'active' && state.hasTag('ready')
  }

  connect(): void {
    if (this.actor.getSnapshot().status === 'stopped') {
      return
    }
    this.actor.stop()
    const actor = createActor(searchConnectionMachine, { input: { api: this.options.api } })
    this.actor = actor
    let previous: SnapshotFrom<typeof searchConnectionMachine> | undefined
    actor.subscribe((state) => {
      if (state.status === 'done') {
        this.options.onRunChanged()
        this.connect()
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
        this.options.onSnapshot(state.context.snapshot)
      }
      if (readFailed) {
        this.options.onFailure()
      }
    })
    actor.start()
  }

  async command(control: SearchControl): Promise<SearchCommandResult | null> {
    return this.invoke(() => this.options.api.controlCharacterSearch(control))
  }

  async invoke(send: () => Promise<SearchCommandResult>): Promise<SearchCommandResult | null> {
    const actor = this.actor
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
          const snapshot = await readSearchSnapshot(this.options.api)
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

  dispose(): void {
    this.actor.stop()
  }
}

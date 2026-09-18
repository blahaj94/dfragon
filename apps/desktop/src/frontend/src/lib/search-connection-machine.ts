import { assign, enqueueActions, fromCallback, fromPromise, setup } from 'xstate'
import { SEARCH_ACTIONS } from '../../../preload/common/types/search'
import type { SearchApi, SearchSnapshot } from '../../../preload/common/types/search'
import { parseSearchResult, parseSearchSnapshot } from '../../../preload/common/search/snapshot'

type ConnectionEvent =
  | { type: 'SUBSCRIBED' }
  | { type: 'SUBSCRIPTION_FAILED' }
  | { type: 'SNAPSHOT'; snapshot: SearchSnapshot }
  | { type: 'RESULT'; snapshot: SearchSnapshot }
  | { type: 'READ_SUCCEEDED'; snapshot: SearchSnapshot }
  | { type: 'READ_FAILED' }
  | { type: 'RUN_CHANGED' }

type ConnectionContext = {
  api: SearchApi
  snapshot: SearchSnapshot | null
  queued: SearchSnapshot | null
}

/** 초기 동기화와 응답 유실 복구에서 같은 검증 경계로 검색 상태를 조회한다. */
export async function readSearchSnapshot(api: SearchApi): Promise<SearchSnapshot> {
  const result = parseSearchResult(
    await api.controlCharacterSearch({ action: SEARCH_ACTIONS.READ })
  )
  if (result == null) {
    throw new Error('Invalid search bridge response')
  }
  return result.snapshot
}

// 구독의 초기 기준과 마지막 조회의 성공 여부는 독립적이다.
// 초기 조회 실패 뒤 event는 받지 않지만, 연결 후 복구 조회 실패 뒤 event는 표시할 수 있다.
export const searchConnectionMachine = setup({
  types: {
    context: {} as ConnectionContext,
    input: {} as { api: SearchApi },
    events: {} as ConnectionEvent
  },
  actors: {
    subscription: fromCallback<ConnectionEvent, SearchApi>(({ input: api, sendBack }) => {
      try {
        const unsubscribe = api.onCharacterSearchChanged((value) => {
          const snapshot = parseSearchSnapshot(value)
          if (snapshot != null) {
            sendBack({ type: 'SNAPSHOT', snapshot })
          }
        })
        sendBack({ type: 'SUBSCRIBED' })
        return unsubscribe
      } catch {
        sendBack({ type: 'SUBSCRIPTION_FAILED' })
        return undefined
      }
    }),
    read: fromPromise(({ input: api }: { input: SearchApi }) => readSearchSnapshot(api))
  },
  actions: {
    acceptSnapshot: enqueueActions(
      ({ context, enqueue }, { snapshot }: { snapshot: SearchSnapshot }) => {
        const previous = context.snapshot
        if (previous != null) {
          if (previous.runId !== snapshot.runId) {
            enqueue.raise({ type: 'RUN_CHANGED' })
            return
          }
          if (snapshot.revision <= previous.revision) {
            return
          }
        }
        enqueue.assign({ snapshot })
      }
    ),
    queueSnapshot: assign(({ context, event }) => {
      if (event.type !== 'SNAPSHOT') {
        return {}
      }
      const previous = context.queued
      const snapshot = event.snapshot
      if (
        previous != null &&
        previous.runId === snapshot.runId &&
        snapshot.revision <= previous.revision
      ) {
        return {}
      }
      return { queued: snapshot }
    }),
    flushQueued: enqueueActions(({ context, enqueue }) => {
      if (context.queued != null) {
        enqueue.raise({ type: 'SNAPSHOT', snapshot: context.queued })
      }
      enqueue.assign({ queued: null })
    })
  }
}).createMachine({
  id: 'searchConnection',
  context: ({ input }) => ({ api: input.api, snapshot: null, queued: null }),
  initial: 'connected',
  states: {
    connected: {
      type: 'parallel',
      invoke: { src: 'subscription', input: ({ context }) => context.api },
      on: {
        RUN_CHANGED: '#searchConnection.replaced',
        RESULT: {
          actions: { type: 'acceptSnapshot', params: ({ event }) => ({ snapshot: event.snapshot }) }
        }
      },
      states: {
        events: {
          initial: 'subscribing',
          states: {
            subscribing: {
              on: {
                SUBSCRIBED: 'loading',
                SUBSCRIPTION_FAILED: {
                  target: 'failed',
                  actions: enqueueActions(({ enqueue }) => enqueue.raise({ type: 'READ_FAILED' }))
                },
                SNAPSHOT: { actions: 'queueSnapshot' }
              }
            },
            loading: {
              on: { SNAPSHOT: { actions: 'queueSnapshot' } },
              invoke: {
                src: 'read',
                input: ({ context }) => context.api,
                onDone: {
                  target: 'listening',
                  actions: [
                    enqueueActions(({ event, enqueue }) =>
                      enqueue.raise({ type: 'READ_SUCCEEDED', snapshot: event.output })
                    ),
                    'flushQueued'
                  ]
                },
                onError: {
                  target: 'failed',
                  actions: [
                    assign({ queued: null }),
                    enqueueActions(({ enqueue }) => enqueue.raise({ type: 'READ_FAILED' }))
                  ]
                }
              }
            },
            failed: {},
            listening: {
              on: {
                SNAPSHOT: {
                  actions: {
                    type: 'acceptSnapshot',
                    params: ({ event }) => ({ snapshot: event.snapshot })
                  }
                }
              }
            }
          }
        },
        synchronization: {
          initial: 'waiting',
          on: {
            READ_SUCCEEDED: {
              target: '.ready',
              actions: {
                type: 'acceptSnapshot',
                params: ({ event }) => ({ snapshot: event.snapshot })
              }
            },
            READ_FAILED: { target: '.failed', actions: assign({ snapshot: null }) }
          },
          states: {
            waiting: {},
            ready: { tags: ['ready'] },
            failed: { tags: ['failed'] }
          }
        }
      }
    },
    replaced: { type: 'final' }
  }
})

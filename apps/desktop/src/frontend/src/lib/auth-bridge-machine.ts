import { assign, enqueueActions, fromCallback, fromPromise, setup } from 'xstate'
import type { AuthApi, AuthSnapshot } from '../../../preload/common/types/auth'
import type { AuthIntent } from '../types/auth'

type BridgeContext = {
  api: AuthApi
  snapshot: AuthSnapshot | null
  queued: AuthSnapshot | null
  intent: AuthIntent | null
}

type BridgeEvent =
  | { type: 'CONNECT'; api: AuthApi }
  | { type: 'RESYNCHRONIZE'; api: AuthApi }
  | { type: 'RECONNECT' }
  | { type: 'SUBSCRIBED' }
  | { type: 'SUBSCRIPTION_FAILED' }
  | { type: 'SNAPSHOT'; snapshot: AuthSnapshot }
  | { type: 'COMMAND'; api: AuthApi; intent: AuthIntent }

// 인증 결과는 main snapshot으로 유지하고 IPC 연결·조회·명령의 수명만 관리한다.
export const authBridgeMachine = setup({
  types: {
    context: {} as BridgeContext,
    input: {} as { api: AuthApi },
    events: {} as BridgeEvent
  },
  actors: {
    subscription: fromCallback<BridgeEvent, AuthApi>(({ input: api, sendBack }) => {
      try {
        const unsubscribe = api.onAuthStateChanged((snapshot) =>
          sendBack({ type: 'SNAPSHOT', snapshot })
        )
        sendBack({ type: 'SUBSCRIBED' })
        return unsubscribe
      } catch {
        sendBack({ type: 'SUBSCRIPTION_FAILED' })
        return undefined
      }
    }),
    readSnapshot: fromPromise(({ input: api }: { input: AuthApi }) => api.getAuthState()),
    command: fromPromise(
      async ({ input }: { input: { api: AuthApi; intent: AuthIntent | null } }) => {
        const { api, intent } = input
        if (intent == null) {
          throw new Error('Auth command intent missing')
        }
        const result = await (intent.type === 'beginLogin'
          ? api.beginLogin({ provider: intent.provider })
          : api.retryAuth())
        return result.snapshot
      }
    )
  },
  guards: {
    sameApi: ({ context, event }) => 'api' in event && event.api === context.api
  },
  actions: {
    resetConnection: assign({ snapshot: null, queued: null, intent: null }),
    acceptSnapshot: enqueueActions(
      ({ context, enqueue }, { snapshot }: { snapshot: AuthSnapshot }) => {
        const previous = context.snapshot
        if (previous != null) {
          if (previous.runId !== snapshot.runId) {
            enqueue.raise({ type: 'RECONNECT' })
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
  id: 'authBridge',
  initial: 'disconnected',
  context: ({ input }) => ({ api: input.api, snapshot: null, queued: null, intent: null }),
  on: {
    CONNECT: {
      target: '.connected',
      reenter: true,
      actions: ['resetConnection', assign({ api: ({ event }) => event.api })]
    },
    RESYNCHRONIZE: {
      guard: 'sameApi',
      target: '.connected',
      reenter: true,
      actions: 'resetConnection'
    }
  },
  states: {
    disconnected: {},
    connected: {
      initial: 'subscribing',
      invoke: { src: 'subscription', input: ({ context }) => context.api },
      on: {
        RECONNECT: { target: 'connected', reenter: true, actions: 'resetConnection' },
        SNAPSHOT: {
          actions: { type: 'acceptSnapshot', params: ({ event }) => ({ snapshot: event.snapshot }) }
        }
      },
      states: {
        subscribing: {
          on: {
            SUBSCRIBED: 'loading',
            SUBSCRIPTION_FAILED: 'failed',
            SNAPSHOT: { actions: 'queueSnapshot' }
          }
        },
        loading: {
          on: { SNAPSHOT: { actions: 'queueSnapshot' } },
          invoke: {
            src: 'readSnapshot',
            input: ({ context }) => context.api,
            onDone: {
              target: 'ready',
              actions: [
                { type: 'acceptSnapshot', params: ({ event }) => ({ snapshot: event.output }) },
                'flushQueued'
              ]
            },
            onError: 'failed'
          }
        },
        failed: {
          tags: ['connectionFailed'],
          // 첫 조회에 실패하면 event만으로 기준을 세우지 않고 수동 재연결을 기다린다.
          on: { SNAPSHOT: {} }
        },
        ready: {
          on: {
            COMMAND: {
              guard: 'sameApi',
              target: 'commanding',
              actions: assign({ intent: ({ event }) => event.intent })
            }
          }
        },
        commanding: {
          tags: ['commandPending'],
          invoke: {
            src: 'command',
            input: ({ context }) => ({ api: context.api, intent: context.intent }),
            onDone: {
              target: 'ready',
              actions: {
                type: 'acceptSnapshot',
                params: ({ event }) => ({ snapshot: event.output })
              }
            },
            // 응답 유실은 조회로 확인하며 mutation을 자동 재전송하지 않는다.
            onError: 'refreshing'
          }
        },
        refreshing: {
          tags: ['commandPending'],
          invoke: {
            src: 'readSnapshot',
            input: ({ context }) => context.api,
            onDone: {
              target: 'ready',
              actions: {
                type: 'acceptSnapshot',
                params: ({ event }) => ({ snapshot: event.output })
              }
            },
            onError: { target: 'unavailable', actions: assign({ snapshot: null }) }
          }
        },
        unavailable: {
          tags: ['connectionFailed'],
          // 구독 기준을 이미 세운 연결은 후속 main event로 다시 현재 상태를 알 수 있다.
          on: {
            SNAPSHOT: {
              target: 'ready',
              actions: {
                type: 'acceptSnapshot',
                params: ({ event }) => ({ snapshot: event.snapshot })
              }
            }
          }
        }
      }
    }
  }
})

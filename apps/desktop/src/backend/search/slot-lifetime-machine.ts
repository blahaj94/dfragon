import { assign, fromCallback, setup } from 'xstate'
import { runSearchRequest, type SearchOutcome, type SearchRuntime } from './request'
import { waitForRetryAfter, type RetryAfter } from './retry-after'

export type SearchRequest = {
  captureId: string
  slot: number
  requestId: string
  observationRevision: number
  nickname: string
  startedAt: number
  runtime: SearchRuntime
}
export type RequestIdentity = Pick<SearchRequest, 'slot' | 'captureId' | 'requestId'>
export type RateWait = RequestIdentity & RetryAfter

type Effects = {
  canComplete: (request: SearchRequest) => boolean
  complete: (request: SearchRequest, outcome: SearchOutcome) => void
  ready: (wait: RateWait) => void
}
type Context = Effects & { request: SearchRequest | null; wait: RateWait | null }
type Event =
  | { type: 'PREPARE'; request: SearchRequest }
  | { type: 'EXECUTE'; request: SearchRequest }
  | { type: 'FINISH'; request: SearchRequest }
  | { type: 'PROMOTE'; observationRevision: number }
  | { type: 'WAIT'; wait: RateWait }
  | { type: 'FINISH_WAIT'; wait: RateWait }
  | { type: 'CANCEL' }

export const slotLifetimeMachine = setup({
  types: {
    context: {} as Context,
    input: {} as Effects,
    events: {} as Event
  },
  actors: {
    search: fromCallback<Event, Effects & { request: SearchRequest }>(({ input }) => {
      const controller = new AbortController()
      let stopped = false
      const { request } = input
      async function execute(): Promise<void> {
        let outcome: SearchOutcome
        try {
          outcome = await runSearchRequest({
            runtime: request.runtime,
            nickname: request.nickname,
            startedAt: request.startedAt,
            signal: controller.signal,
            isCurrent: () => input.canComplete(request)
          })
        } catch {
          outcome = {
            kind: 'failure',
            error: { code: 'SEARCH_NETWORK_ERROR', retryAfterSeconds: null },
            retryAfterReceivedAt: null
          }
        }
        if (!stopped) {
          input.complete(request, outcome)
        }
      }
      void execute()
      return () => {
        stopped = true
        controller.abort()
      }
    }),
    retryAfter: fromCallback<Event, { wait: RateWait; ready: Effects['ready'] }>(({ input }) =>
      waitForRetryAfter({ ...input.wait, onReady: () => input.ready(input.wait) })
    )
  }
}).createMachine({
  id: 'searchSlotLifetime',
  context: ({ input }) => ({ ...input, request: null, wait: null }),
  initial: 'idle',
  on: {
    CANCEL: {
      target: '.idle',
      actions: assign({ request: null, wait: null })
    },
    PREPARE: {
      target: '.prepared',
      actions: assign({ request: ({ event }) => event.request, wait: null })
    },
    PROMOTE: {
      actions: ({ context, event }) => {
        // The running invocation shares this accepted revision; its budget stays fixed.
        if (context.request != null) {
          context.request.observationRevision = event.observationRevision
        }
      }
    },
    WAIT: {
      target: '.rateLimited',
      actions: assign({ request: null, wait: ({ event }) => event.wait })
    }
  },
  states: {
    idle: {},
    // Publish the synchronous pending DTO before starting transport. A publication may
    // invalidate this request, so EXECUTE must still identify this prepared invocation.
    prepared: {
      on: {
        EXECUTE: {
          guard: ({ context, event }) => context.request === event.request,
          target: 'requesting'
        }
      }
    },
    requesting: {
      invoke: {
        src: 'search',
        input: ({ context }) => ({ ...context, request: context.request! })
      },
      on: {
        FINISH: {
          guard: ({ context, event }) => context.request === event.request,
          target: 'settled',
          actions: assign({ request: null })
        }
      }
    },
    settled: {},
    rateLimited: {
      invoke: {
        src: 'retryAfter',
        input: ({ context }) => ({ wait: context.wait!, ready: context.ready })
      },
      on: {
        FINISH_WAIT: {
          guard: ({ context, event }) => context.wait === event.wait,
          target: 'settled',
          actions: assign({ wait: null })
        }
      }
    }
  }
})

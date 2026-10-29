import { assign, fromCallback, setup } from 'xstate'
import { runSearchRequest, type SearchOutcome, type SearchRuntime } from './request'
import { reportSearchOutcome } from './diagnostics'
import type { OcrSearchInput } from '../../preload/common/types/search'

export type SearchRequest = {
  captureId: string
  slot: number
  requestId: string
  observationRevision: number
  nickname: string
  startedAt: number
  runtime: SearchRuntime
  ocrInput?: OcrSearchInput
  manualServerId?: string
}
export type RequestIdentity = Pick<SearchRequest, 'slot' | 'captureId' | 'requestId'>

type Effects = {
  canComplete: (request: SearchRequest) => boolean
  complete: (request: SearchRequest, outcome: SearchOutcome) => void
}
type Context = Effects & { request: SearchRequest | null }
type Event =
  | { type: 'PREPARE'; request: SearchRequest }
  | { type: 'EXECUTE'; request: SearchRequest }
  | { type: 'FINISH'; request: SearchRequest }
  | { type: 'PROMOTE'; observationRevision: number }
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
            isCurrent: () => input.canComplete(request),
            ocrInput: request.ocrInput,
            manualServerId: request.manualServerId
          })
        } catch {
          outcome = { kind: 'failure', error: { code: 'SEARCH_NETWORK_ERROR' } }
        }
        if (!stopped) {
          reportSearchOutcome(outcome, request.runtime.ocrIdentification)
          input.complete(request, outcome)
        }
      }
      execute()

      return () => {
        stopped = true
        controller.abort()
      }
    })
  }
}).createMachine({
  id: 'searchSlotLifetime',
  context: ({ input }) => ({ ...input, request: null }),
  initial: 'idle',
  on: {
    CANCEL: {
      target: '.idle',
      actions: assign({ request: null })
    },
    PREPARE: {
      target: '.prepared',
      actions: assign({ request: ({ event }) => event.request })
    },
    PROMOTE: {
      actions: ({ context, event }) => {
        // The running invocation shares this accepted revision; its budget stays fixed.
        if (context.request != null) {
          context.request.observationRevision = event.observationRevision
        }
      }
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
    settled: {}
  }
})

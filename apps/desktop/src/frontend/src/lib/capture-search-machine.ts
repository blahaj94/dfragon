import { assign, fromCallback, setup } from 'xstate'
import type {
  SearchCommandResult,
  SearchControl,
  SearchSnapshot
} from '../../../preload/common/types/search'
import { SEARCH_ACTIONS } from '../../../preload/common/types/search'

type BeginRequest = {
  signal: AbortSignal
  resolve: (captureId: string | null) => void
  reject: (error: unknown) => void
}
type SearchLifetimeEffects = {
  command: (control: SearchControl) => Promise<SearchCommandResult | null>
  readSnapshot: () => SearchSnapshot | null
  resetObservations: () => void
}
type StartResult = { captureId: string | null; cancelled: boolean }
type LifetimeEvent =
  | ({ type: 'BEGIN' } & BeginRequest)
  | { type: 'STARTED'; result: StartResult }
  | { type: 'START_FAILED'; error: unknown }
  | { type: 'END' }
  | { type: 'INVALIDATE' }
  | { type: 'DISPOSE' }
type LifetimeContext = {
  effects: SearchLifetimeEffects
  request: BeginRequest | null
  captureId: string | null
}

/** 직접 begin 응답과 최신 snapshot을 비교한 뒤 호출자의 취소 여부를 한 번 확인한다. */
export function inspectCaptureStart(
  result: SearchCommandResult | null,
  latest: SearchSnapshot | null,
  signal: AbortSignal
): StartResult {
  const captureId = result?.ok === true ? result.snapshot.captureId : null
  const completed = result?.snapshot
  let superseded = false
  if (latest != null) {
    if (completed != null) {
      const changedRun = latest.runId !== completed.runId
      const newerSnapshot = latest.revision > completed.revision
      const differentCapture = latest.captureId !== captureId
      superseded = changedRun || (newerSnapshot && differentCapture)
    } else {
      // 응답이 없어도 기존 snapshot 접근·취소 판정 순서를 유지한다.
      const differentCapture = latest.captureId !== captureId
      superseded = differentCapture && completed != null
    }
  }
  const aborted = signal.aborted
  return { captureId, cancelled: aborted || superseded }
}

// 초기 요청 actor는 종료돼도 직접 응답을 기다려 자신이 만든 늦은 capture만 정리한다.
export const captureSearchMachine = setup({
  types: {
    context: {} as LifetimeContext,
    input: {} as SearchLifetimeEffects,
    events: {} as LifetimeEvent
  },
  actors: {
    begin: fromCallback<LifetimeEvent, { effects: SearchLifetimeEffects; request: BeginRequest }>(
      ({ input: { effects, request }, sendBack }) => {
        const controller = new AbortController()
        async function start(): Promise<void> {
          try {
            const response = await effects.command({ action: SEARCH_ACTIONS.BEGIN })
            const result = inspectCaptureStart(response, effects.readSnapshot(), request.signal)
            if (controller.signal.aborted) {
              if (result.captureId != null) {
                void effects.command({ action: SEARCH_ACTIONS.END, captureId: result.captureId })
              }
              request.resolve(null)
              return
            }
            sendBack({ type: 'STARTED', result })
          } catch (error) {
            if (controller.signal.aborted) {
              request.reject(error)
            } else {
              sendBack({ type: 'START_FAILED', error })
            }
          }
        }
        void start()
        return () => controller.abort()
      }
    )
  },
  guards: {
    hasCapture: ({ event }) =>
      event.type === 'STARTED' && !event.result.cancelled && event.result.captureId != null
  },
  actions: {
    endCapture: ({ context }) => {
      if (context.captureId != null) {
        void context.effects.command({ action: SEARCH_ACTIONS.END, captureId: context.captureId })
      }
    },
    resetObservations: ({ context }) => context.effects.resetObservations(),
    forgetCapture: assign({ captureId: null, request: null }),
    finishStart: ({ context, event }) => {
      if (event.type === 'STARTED') {
        context.request?.resolve(event.result.captureId)
      }
    },
    rejectStart: ({ context, event }) => {
      if (event.type !== 'STARTED') {
        return
      }
      if (event.result.captureId != null) {
        void context.effects.command({
          action: SEARCH_ACTIONS.END,
          captureId: event.result.captureId
        })
      }
      context.request?.resolve(null)
    }
  }
}).createMachine({
  id: 'captureSearch',
  context: ({ input }) => ({ effects: input, request: null, captureId: null }),
  initial: 'idle',
  on: {
    BEGIN: {
      target: '.starting',
      reenter: true,
      actions: [
        'endCapture',
        'resetObservations',
        assign({
          captureId: null,
          request: ({ event }) => ({
            signal: event.signal,
            resolve: event.resolve,
            reject: event.reject
          })
        })
      ]
    },
    END: { target: '.idle', actions: ['endCapture', 'resetObservations', 'forgetCapture'] },
    INVALIDATE: { target: '.invalidated', actions: ['resetObservations', 'forgetCapture'] },
    DISPOSE: { target: '.disposed', actions: ['endCapture', 'resetObservations', 'forgetCapture'] }
  },
  states: {
    idle: {},
    starting: {
      invoke: {
        src: 'begin',
        // BEGIN만 starting에 진입하며 같은 전이에서 request를 기록한다.
        input: ({ context }) => ({ effects: context.effects, request: context.request! })
      },
      on: {
        START_FAILED: {
          target: 'idle',
          actions: [({ context, event }) => context.request?.reject(event.error), 'forgetCapture']
        },
        STARTED: [
          {
            guard: 'hasCapture',
            target: 'active',
            actions: [
              assign({ captureId: ({ event }) => event.result.captureId }),
              'finishStart',
              assign({ request: null })
            ]
          },
          { target: 'idle', actions: ['rejectStart', 'forgetCapture'] }
        ]
      }
    },
    active: {},
    invalidated: {},
    disposed: { type: 'final' }
  }
})

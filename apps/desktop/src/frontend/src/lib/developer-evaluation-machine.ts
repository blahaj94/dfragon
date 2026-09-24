import { assign, fromPromise, setup } from 'xstate'
import type { DeveloperSample } from '../../../preload/common/types/developer'
import type { DeveloperEvaluation, EvaluationPreprocessing } from './developer-evaluation'
import { runDeveloperEvaluation, type DeveloperEvaluationRun } from './developer-evaluation-run'

type EvaluationContext = {
  samples: readonly DeveloperSample[]
  request: object | null
  preprocessing: EvaluationPreprocessing
  results: Record<string, DeveloperEvaluation>
  progress: { done: number; total: number }
}
type EvaluationEvent =
  | { type: 'EVALUATE'; samples: readonly DeveloperSample[]; request: object }
  | { type: 'PREPROCESSING_CHANGED'; value: EvaluationPreprocessing }
  | { type: 'CANCEL' }
  | { type: 'IMAGE_EVALUATED'; id: string; result: DeveloperEvaluation }

export const developerEvaluationMachine = setup({
  types: { context: {} as EvaluationContext, events: {} as EvaluationEvent },
  actors: {
    evaluate: fromPromise<void, DeveloperEvaluationRun>(({ input, signal }) =>
      runDeveloperEvaluation(input, signal)
    )
  },
  guards: { hasSamples: ({ event }) => event.type === 'EVALUATE' && event.samples.length > 0 },
  actions: {
    beginRun: assign(({ context, event }) => {
      if (event.type !== 'EVALUATE') {
        return {}
      }
      // 이번 평가 대상의 이전 결과만 지워 다른 이미지의 점수는 유지한다.
      const ids = new Set(event.samples.map((sample) => sample.id))
      return {
        samples: event.samples,
        request: event.request,
        progress: { done: 0, total: event.samples.length },
        results: Object.fromEntries(Object.entries(context.results).filter(([id]) => !ids.has(id)))
      }
    }),
    recordResult: assign(({ context, event }) =>
      event.type === 'IMAGE_EVALUATED'
        ? {
            results: { ...context.results, [event.id]: event.result },
            progress: { ...context.progress, done: context.progress.done + 1 }
          }
        : {}
    ),
    changePreprocessing: assign(({ event }) =>
      event.type === 'PREPROCESSING_CHANGED'
        ? {
            preprocessing: event.value,
            results: {},
            progress: { done: 0, total: 0 },
            samples: [],
            request: null
          }
        : {}
    )
  }
}).createMachine({
  id: 'developerEvaluation',
  initial: 'idle',
  context: {
    samples: [],
    request: null,
    preprocessing: 'party',
    results: {},
    progress: { done: 0, total: 0 }
  },
  on: {
    EVALUATE: { guard: 'hasSamples', target: '.running', actions: 'beginRun' },
    PREPROCESSING_CHANGED: { target: '.idle', actions: 'changePreprocessing' }
  },
  states: {
    idle: {},
    running: {
      on: {
        EVALUATE: {},
        CANCEL: 'canceled',
        IMAGE_EVALUATED: { actions: 'recordResult' }
      },
      invoke: {
        src: 'evaluate',
        input: ({ context, self }) => ({
          samples: context.samples,
          preprocessing: context.preprocessing,
          report: (id, result) => self.send({ type: 'IMAGE_EVALUATED', id, result })
        }),
        onDone: 'completed',
        onError: 'failed'
      }
    },
    completed: {},
    canceled: {},
    failed: {}
  }
})

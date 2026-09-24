import { assign, fromPromise, setup } from 'xstate'
import { DEVELOPER_EVENTS, DEVELOPER_ERRORS } from '../constants/developer'
import type { DeveloperApi, DeveloperSample } from '../../../preload/common/types/developer'

export type DeveloperSamplesApi = Pick<
  DeveloperApi,
  'listSamples' | 'saveLabel' | 'setSampleExcluded'
>

type SaveIntent =
  | { type: typeof DEVELOPER_EVENTS.SAVE_LABEL; id: string; text: string | null }
  | { type: typeof DEVELOPER_EVENTS.SET_SAMPLE_EXCLUDED; id: string; excluded: boolean }

type ActiveSave = { request: object; intent: SaveIntent }

type SamplesContext = {
  api: DeveloperSamplesApi
  samples: DeveloperSample[]
  error: string
  loadRequests: object[]
  queuedRefreshes: object[]
  lastRefreshRequests: object[]
  preserveSaveError: boolean
  activeSave: ActiveSave | null
  lastSave: { request: object; sample: DeveloperSample | null } | null
}

type SamplesEvent =
  | { type: typeof DEVELOPER_EVENTS.REFRESH; request: object }
  | { type: typeof DEVELOPER_EVENTS.SAVE_LABEL; request: object; id: string; text: string | null }
  | {
      type: typeof DEVELOPER_EVENTS.SET_SAMPLE_EXCLUDED
      request: object
      id: string
      excluded: boolean
    }
  | { type: typeof DEVELOPER_EVENTS.CANCEL }

// 목록 조회와 저장은 같은 시점에 완료되지 않도록 직렬화해 저장된 메타데이터를 보존한다.
export const developerSamplesMachine = setup({
  types: {
    context: {} as SamplesContext,
    input: {} as { api: DeveloperSamplesApi },
    events: {} as SamplesEvent
  },
  actors: {
    listSamples: fromPromise<DeveloperSample[], DeveloperSamplesApi>(({ input: api }) =>
      api.listSamples()
    ),
    saveSample: fromPromise<DeveloperSample, { api: DeveloperSamplesApi; save: ActiveSave | null }>(
      async ({ input }: { input: { api: DeveloperSamplesApi; save: ActiveSave | null } }) => {
        if (input.save == null) {
          throw new Error(DEVELOPER_ERRORS.SAVE_REQUEST_MISSING)
        }

        const { intent } = input.save
        if (intent.type === DEVELOPER_EVENTS.SAVE_LABEL) {
          return input.api.saveLabel(intent.id, intent.text)
        }
        return input.api.setSampleExcluded(intent.id, intent.excluded)
      }
    )
  },
  guards: {
    hasRefreshRequest: ({ context }) =>
      context.loadRequests.length > 0 || context.queuedRefreshes.length > 0,
    hasQueuedRefresh: ({ context }) => context.queuedRefreshes.length > 0
  },
  actions: {
    startRefresh: assign(({ event }) =>
      event.type === DEVELOPER_EVENTS.REFRESH
        ? {
            loadRequests: [event.request],
            queuedRefreshes: [],
            error: '',
            preserveSaveError: false
          }
        : {}
    ),
    queueRefresh: assign(({ context, event }) =>
      event.type === DEVELOPER_EVENTS.REFRESH
        ? { queuedRefreshes: [...context.queuedRefreshes, event.request] }
        : {}
    ),
    startQueuedRefresh: assign(({ context }) => ({
      loadRequests: context.queuedRefreshes,
      queuedRefreshes: []
    })),
    failRefresh: assign(({ context }) => ({
      error: context.preserveSaveError ? context.error : DEVELOPER_ERRORS.LOAD_SAMPLES,
      lastRefreshRequests: context.loadRequests,
      loadRequests: []
    })),
    cancelRefresh: assign(({ context }) => ({
      lastRefreshRequests: [...context.loadRequests, ...context.queuedRefreshes],
      loadRequests: [],
      queuedRefreshes: []
    })),
    startSaveLabel: assign(({ event }) =>
      event.type === DEVELOPER_EVENTS.SAVE_LABEL
        ? {
            activeSave: {
              request: event.request,
              intent: { type: DEVELOPER_EVENTS.SAVE_LABEL, id: event.id, text: event.text }
            },
            error: '',
            preserveSaveError: false
          }
        : {}
    ),
    startSetSampleExcluded: assign(({ event }) =>
      event.type === DEVELOPER_EVENTS.SET_SAMPLE_EXCLUDED
        ? {
            activeSave: {
              request: event.request,
              intent: {
                type: DEVELOPER_EVENTS.SET_SAMPLE_EXCLUDED,
                id: event.id,
                excluded: event.excluded
              }
            },
            error: '',
            preserveSaveError: false
          }
        : {}
    ),
    failSave: assign(({ context }) => ({
      error: DEVELOPER_ERRORS.SAVE_SAMPLE,
      preserveSaveError: true,
      lastSave:
        context.activeSave == null
          ? context.lastSave
          : { request: context.activeSave.request, sample: null },
      activeSave: null
    })),
    cancelSave: assign(({ context }) => ({
      lastRefreshRequests: [...context.loadRequests, ...context.queuedRefreshes],
      loadRequests: [],
      queuedRefreshes: [],
      lastSave:
        context.activeSave == null
          ? context.lastSave
          : { request: context.activeSave.request, sample: null },
      activeSave: null
    }))
  }
}).createMachine({
  id: 'developerSamples',
  initial: 'loading',
  context: ({ input }) => ({
    api: input.api,
    samples: [],
    error: '',
    loadRequests: [],
    queuedRefreshes: [],
    lastRefreshRequests: [],
    preserveSaveError: false,
    activeSave: null,
    lastSave: null
  }),
  states: {
    loading: {
      invoke: {
        src: 'listSamples',
        input: ({ context }) => context.api,
        onDone: {
          target: '#developerSamples.idle.ready',
          actions: assign(({ context, event }) => ({
            samples: event.output,
            error: context.preserveSaveError ? context.error : '',
            lastRefreshRequests: context.loadRequests,
            loadRequests: []
          }))
        },
        onError: { target: '#developerSamples.idle.loadError', actions: 'failRefresh' }
      },
      on: {
        [DEVELOPER_EVENTS.REFRESH]: { actions: 'queueRefresh' },
        [DEVELOPER_EVENTS.CANCEL]: {
          guard: 'hasRefreshRequest',
          target: '#developerSamples.idle.ready',
          actions: 'cancelRefresh'
        }
      }
    },
    idle: {
      initial: 'ready',
      always: {
        guard: 'hasQueuedRefresh',
        target: '#developerSamples.loading',
        actions: 'startQueuedRefresh'
      },
      on: {
        [DEVELOPER_EVENTS.REFRESH]: {
          target: '#developerSamples.loading',
          actions: 'startRefresh'
        },
        [DEVELOPER_EVENTS.SAVE_LABEL]: {
          target: '#developerSamples.saving',
          actions: 'startSaveLabel'
        },
        [DEVELOPER_EVENTS.SET_SAMPLE_EXCLUDED]: {
          target: '#developerSamples.saving',
          actions: 'startSetSampleExcluded'
        }
      },
      states: {
        ready: {},
        loadError: {},
        saveError: {}
      }
    },
    saving: {
      invoke: {
        src: 'saveSample',
        input: ({ context }) => ({ api: context.api, save: context.activeSave }),
        onDone: {
          target: '#developerSamples.idle.ready',
          actions: assign(({ context, event }) => {
            const sample = event.output
            if (context.activeSave == null) {
              return {}
            }

            return {
              samples: context.samples.some((row) => row.id === sample.id)
                ? context.samples.map((row) => (row.id === sample.id ? sample : row))
                : [...context.samples, sample],
              error: '',
              preserveSaveError: false,
              lastSave: { request: context.activeSave.request, sample },
              activeSave: null
            }
          })
        },
        onError: { target: '#developerSamples.idle.saveError', actions: 'failSave' }
      },
      on: {
        // Keep reads behind the write and coalesce them into one trailing load.
        [DEVELOPER_EVENTS.REFRESH]: { actions: 'queueRefresh' },
        [DEVELOPER_EVENTS.CANCEL]: { target: '#developerSamples.idle.ready', actions: 'cancelSave' }
      }
    }
  }
})

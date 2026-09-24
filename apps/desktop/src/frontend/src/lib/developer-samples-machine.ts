import { assign, fromPromise, setup } from 'xstate'
import { DEVELOPER_EVENTS, DEVELOPER_ERRORS } from '../constants/developer'
import type { DeveloperApi, DeveloperSample } from '../../../preload/common/types/developer'

type SamplesApi = Pick<DeveloperApi, 'listSamples' | 'addSample' | 'saveLabel'>

type SaveIntent =
  | { type: typeof DEVELOPER_EVENTS.ADD_SAMPLE; pngDataUrl: string }
  | { type: typeof DEVELOPER_EVENTS.SAVE_LABEL; id: string; text: string | null }

type ActiveSave = { request: object; intent: SaveIntent }

type SamplesContext = {
  api: SamplesApi
  samples: DeveloperSample[]
  error: string
  loadRequest: object | null
  lastRefresh: object | null
  activeSave: ActiveSave | null
  lastSave: { request: object; sample: DeveloperSample | null } | null
}

type SamplesEvent =
  | { type: typeof DEVELOPER_EVENTS.REFRESH; request: object }
  | { type: typeof DEVELOPER_EVENTS.ADD_SAMPLE; request: object; pngDataUrl: string }
  | { type: typeof DEVELOPER_EVENTS.SAVE_LABEL; request: object; id: string; text: string | null }
  | { type: typeof DEVELOPER_EVENTS.CANCEL }

// 목록 조회와 저장은 같은 시점에 완료되지 않도록 직렬화해 저장된 메타데이터를 보존한다.
export const developerSamplesMachine = setup({
  types: {
    context: {} as SamplesContext,
    input: {} as { api: SamplesApi },
    events: {} as SamplesEvent
  },
  actors: {
    listSamples: fromPromise<DeveloperSample[], SamplesApi>(({ input: api }) => api.listSamples()),
    saveSample: fromPromise<DeveloperSample, { api: SamplesApi; save: ActiveSave | null }>(
      async ({ input }: { input: { api: SamplesApi; save: ActiveSave | null } }) => {
        if (input.save == null) {
          throw new Error(DEVELOPER_ERRORS.SAVE_REQUEST_MISSING)
        }

        const { intent } = input.save
        return intent.type === DEVELOPER_EVENTS.ADD_SAMPLE
          ? input.api.addSample(intent.pngDataUrl)
          : input.api.saveLabel(intent.id, intent.text)
      }
    )
  },
  guards: {
    hasRefreshRequest: ({ context }) => context.loadRequest != null
  },
  actions: {
    startRefresh: assign(({ event }) =>
      event.type === DEVELOPER_EVENTS.REFRESH ? { loadRequest: event.request, error: '' } : {}
    ),
    failRefresh: assign(({ context }) => ({
      error: DEVELOPER_ERRORS.LOAD_SAMPLES,
      lastRefresh: context.loadRequest,
      loadRequest: null
    })),
    cancelRefresh: assign(({ context }) => ({
      lastRefresh: context.loadRequest,
      loadRequest: null
    })),
    startAddSample: assign(({ event }) =>
      event.type === DEVELOPER_EVENTS.ADD_SAMPLE
        ? {
            activeSave: {
              request: event.request,
              intent: { type: DEVELOPER_EVENTS.ADD_SAMPLE, pngDataUrl: event.pngDataUrl }
            },
            error: ''
          }
        : {}
    ),
    startSaveLabel: assign(({ event }) =>
      event.type === DEVELOPER_EVENTS.SAVE_LABEL
        ? {
            activeSave: {
              request: event.request,
              intent: { type: DEVELOPER_EVENTS.SAVE_LABEL, id: event.id, text: event.text }
            },
            error: ''
          }
        : {}
    ),
    failSave: assign(({ context }) => ({
      error: DEVELOPER_ERRORS.SAVE_SAMPLE,
      lastSave:
        context.activeSave == null
          ? context.lastSave
          : { request: context.activeSave.request, sample: null },
      activeSave: null
    })),
    cancelSave: assign(({ context }) => ({
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
    loadRequest: null,
    lastRefresh: null,
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
            error: '',
            lastRefresh: context.loadRequest,
            loadRequest: null
          }))
        },
        onError: { target: '#developerSamples.idle.loadError', actions: 'failRefresh' }
      },
      on: {
        [DEVELOPER_EVENTS.CANCEL]: {
          guard: 'hasRefreshRequest',
          target: '#developerSamples.idle.ready',
          actions: 'cancelRefresh'
        }
      }
    },
    idle: {
      initial: 'ready',
      on: {
        [DEVELOPER_EVENTS.REFRESH]: {
          target: '#developerSamples.loading',
          actions: 'startRefresh'
        },
        [DEVELOPER_EVENTS.ADD_SAMPLE]: {
          target: '#developerSamples.saving',
          actions: 'startAddSample'
        },
        [DEVELOPER_EVENTS.SAVE_LABEL]: {
          target: '#developerSamples.saving',
          actions: 'startSaveLabel'
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
              lastSave: { request: context.activeSave.request, sample },
              activeSave: null
            }
          })
        },
        onError: { target: '#developerSamples.idle.saveError', actions: 'failSave' }
      },
      on: {
        // Saving is exclusive. Ignore a concurrent refresh or save command.
        [DEVELOPER_EVENTS.CANCEL]: { target: '#developerSamples.idle.ready', actions: 'cancelSave' }
      }
    }
  }
})

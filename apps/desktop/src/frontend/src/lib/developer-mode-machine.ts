import { assign, fromPromise, setup } from 'xstate'
import { DEVELOPER_EVENTS, DEVELOPER_ERRORS } from '../constants/developer'
import type { DeveloperApi } from '../../../preload/common/types/developer'

export type DeveloperSettingsApi = Pick<DeveloperApi, 'getSettings' | 'setEnabled'>

type DeveloperModeContext = {
  api: DeveloperSettingsApi | null
  enabled: boolean
  requestedEnabled: boolean
}

type DeveloperModeEvent =
  | { type: typeof DEVELOPER_EVENTS.RETRY; api: DeveloperSettingsApi | null }
  | {
      type: typeof DEVELOPER_EVENTS.SET_ENABLED
      api: DeveloperSettingsApi | null
      enabled: boolean
    }

function readEnabled(settings: unknown): boolean {
  if (
    settings == null ||
    typeof settings !== 'object' ||
    !('enabled' in settings) ||
    typeof settings.enabled !== 'boolean'
  ) {
    throw new TypeError(DEVELOPER_ERRORS.INVALID_SETTINGS)
  }

  return settings.enabled
}

// Renderer settings are validated at the IPC boundary before they can enable developer features.
export const developerModeMachine = setup({
  types: {
    context: {} as DeveloperModeContext,
    input: {} as { api: DeveloperSettingsApi | null },
    events: {} as DeveloperModeEvent
  },
  actors: {
    readSettings: fromPromise(
      async ({ input: api }: { input: DeveloperSettingsApi | null }): Promise<boolean | null> => {
        if (api == null) {
          return null
        }

        return readEnabled(await api.getSettings())
      }
    ),
    persistSetting: fromPromise(
      async ({ input }: { input: { api: DeveloperSettingsApi | null; enabled: boolean } }) => {
        if (input.api == null) {
          throw new TypeError(DEVELOPER_ERRORS.SETTINGS_API_UNAVAILABLE)
        }

        return readEnabled(await input.api.setEnabled(input.enabled))
      }
    )
  },
  guards: {
    hasApi: ({ event }) => 'api' in event && event.api != null
  },
  actions: {
    failClosed: assign({ enabled: false }),
    acceptRequest: assign(({ context, event }) => {
      if (event.type !== DEVELOPER_EVENTS.SET_ENABLED) {
        return {}
      }

      return {
        api: event.api,
        requestedEnabled: event.enabled,
        enabled: event.enabled ? context.enabled : false
      }
    }),
    failClosedForRetry: assign(({ event }) =>
      event.type === DEVELOPER_EVENTS.RETRY
        ? { api: event.api, enabled: false }
        : { enabled: false }
    )
  }
}).createMachine({
  id: 'developerMode',
  initial: 'loading',
  context: ({ input }) => ({ api: input.api, enabled: false, requestedEnabled: false }),
  on: {
    [DEVELOPER_EVENTS.RETRY]: [
      { guard: 'hasApi', target: '.loading', actions: 'failClosedForRetry' },
      { target: '.unavailable', actions: 'failClosedForRetry' }
    ]
  },
  states: {
    loading: {
      invoke: {
        src: 'readSettings',
        input: ({ context }) => context.api,
        onDone: [
          {
            guard: ({ event }) => event.output != null,
            target: 'ready',
            actions: assign({ enabled: ({ event }) => event.output === true })
          },
          { target: 'unavailable', actions: 'failClosed' }
        ],
        onError: { target: 'error', actions: 'failClosed' }
      },
      on: {
        [DEVELOPER_EVENTS.RETRY]: {},
        [DEVELOPER_EVENTS.SET_ENABLED]: {}
      }
    },
    ready: {
      on: {
        [DEVELOPER_EVENTS.SET_ENABLED]: [
          { guard: 'hasApi', target: 'updating', actions: 'acceptRequest' },
          { target: 'unavailable', actions: 'failClosed' }
        ]
      }
    },
    updating: {
      invoke: {
        src: 'persistSetting',
        input: ({ context }) => ({ api: context.api, enabled: context.requestedEnabled }),
        onDone: [
          {
            guard: ({ context, event }) => event.output === context.requestedEnabled,
            target: 'ready',
            actions: assign({ enabled: ({ event }) => event.output === true })
          },
          { target: 'error', actions: 'failClosed' }
        ],
        onError: { target: 'error', actions: 'failClosed' }
      },
      on: {
        [DEVELOPER_EVENTS.RETRY]: {},
        [DEVELOPER_EVENTS.SET_ENABLED]: {}
      }
    },
    unavailable: {},
    error: {}
  }
})

import { assign, fromPromise, setup } from 'xstate'
import type { DeveloperApi } from '../../../preload/common/types/developer'

export type DeveloperSettingsApi = Pick<DeveloperApi, 'getSettings' | 'setEnabled'>

type DeveloperModeContext = {
  api: DeveloperSettingsApi | null
  enabled: boolean
  requestedEnabled: boolean
}

type DeveloperModeEvent =
  | { type: 'RETRY'; api: DeveloperSettingsApi | null }
  | { type: 'SET_ENABLED'; api: DeveloperSettingsApi | null; enabled: boolean }

function readEnabled(settings: unknown): boolean {
  if (
    settings == null ||
    typeof settings !== 'object' ||
    !('enabled' in settings) ||
    typeof settings.enabled !== 'boolean'
  ) {
    throw new TypeError('Invalid developer settings response')
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
          throw new TypeError('Developer settings API unavailable')
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
      if (event.type !== 'SET_ENABLED') {
        return {}
      }

      return {
        api: event.api,
        requestedEnabled: event.enabled,
        enabled: event.enabled ? context.enabled : false
      }
    }),
    failClosedForRetry: assign(({ event }) =>
      event.type === 'RETRY' ? { api: event.api, enabled: false } : { enabled: false }
    )
  }
}).createMachine({
  id: 'developerMode',
  initial: 'loading',
  context: ({ input }) => ({ api: input.api, enabled: false, requestedEnabled: false }),
  on: {
    RETRY: [
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
        RETRY: {},
        SET_ENABLED: {}
      }
    },
    ready: {
      on: {
        SET_ENABLED: [
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
        RETRY: {},
        SET_ENABLED: {}
      }
    },
    unavailable: {},
    error: {}
  }
})

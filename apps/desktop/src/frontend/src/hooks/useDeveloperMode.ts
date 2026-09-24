import { useCallback } from 'react'
import { useMachine } from '@xstate/react'
import { developerModeMachine, type DeveloperSettingsApi } from '../lib/developer-mode-machine'

export type DeveloperModeState = {
  status: 'loading' | 'ready' | 'unavailable' | 'error'
  enabled: boolean
  updating: boolean
  retry: () => void
  setEnabled: (enabled: boolean) => void
}

function isDeveloperSettingsApi(value: unknown): value is DeveloperSettingsApi {
  if (value == null || typeof value !== 'object') {
    return false
  }

  return (
    'getSettings' in value &&
    typeof value.getSettings === 'function' &&
    'setEnabled' in value &&
    typeof value.setEnabled === 'function'
  )
}

function getDeveloperSettingsApi(): DeveloperSettingsApi | null {
  const candidate =
    typeof window === 'undefined'
      ? undefined
      : (window as Window & { developer?: unknown }).developer

  return isDeveloperSettingsApi(candidate) ? candidate : null
}

export function useDeveloperMode(): DeveloperModeState {
  const [state, send] = useMachine(developerModeMachine, {
    input: { api: getDeveloperSettingsApi() }
  })

  const retry = useCallback(() => {
    send({ type: 'RETRY', api: getDeveloperSettingsApi() })
  }, [send])

  const setEnabled = useCallback(
    (enabled: boolean) => {
      send({ type: 'SET_ENABLED', api: getDeveloperSettingsApi(), enabled })
    },
    [send]
  )

  const status = state.matches('loading')
    ? 'loading'
    : state.matches('ready') || state.matches('updating')
      ? 'ready'
      : state.matches('unavailable')
        ? 'unavailable'
        : 'error'

  return {
    status,
    enabled: state.context.enabled,
    updating: state.matches('updating'),
    retry,
    setEnabled
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeveloperApi } from '../../../preload/common/types/developer'

type DeveloperSettingsApi = Pick<DeveloperApi, 'getSettings' | 'setEnabled'>

export type DeveloperModeState = {
  status: 'loading' | 'ready' | 'unavailable' | 'error'
  enabled: boolean
  updating: boolean
  retry: () => void
  setEnabled: (enabled: boolean) => void
}

const initialState: Omit<DeveloperModeState, 'retry' | 'setEnabled'> = {
  status: 'loading',
  enabled: false,
  updating: false
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

export function useDeveloperMode(): DeveloperModeState {
  const [view, setView] = useState(initialState)
  const viewRef = useRef(view)
  const operationRef = useRef(0)
  const inFlightRef = useRef(false)
  const mountedRef = useRef(false)

  const updateView = useCallback((next: typeof initialState) => {
    viewRef.current = next
    if (mountedRef.current) {
      setView(next)
    }
  }, [])

  const retry = useCallback(() => {
    if (inFlightRef.current) {
      return
    }

    const operation = ++operationRef.current
    inFlightRef.current = true
    updateView({ status: 'loading', enabled: false, updating: false })

    const api = getDeveloperSettingsApi()
    if (api == null) {
      inFlightRef.current = false
      updateView({ status: 'unavailable', enabled: false, updating: false })
      return
    }

    void Promise.resolve()
      .then(() => api.getSettings())
      .then((settings) => {
        const enabled = readEnabled(settings)
        if (operation === operationRef.current) {
          updateView({ status: 'ready', enabled, updating: false })
        }
      })
      .catch(() => {
        if (operation === operationRef.current) {
          updateView({ status: 'error', enabled: false, updating: false })
        }
      })
      .finally(() => {
        if (operation === operationRef.current) {
          inFlightRef.current = false
        }
      })
  }, [updateView])

  const setEnabled = useCallback(
    (enabled: boolean) => {
      const current = viewRef.current
      if (current.status !== 'ready' || current.updating || inFlightRef.current) {
        return
      }

      const api = getDeveloperSettingsApi()
      if (api == null) {
        updateView({ status: 'unavailable', enabled: false, updating: false })
        return
      }

      const operation = ++operationRef.current
      inFlightRef.current = true
      updateView({ status: 'ready', enabled: enabled ? current.enabled : false, updating: true })

      void Promise.resolve()
        .then(() => api.setEnabled(enabled))
        .then((settings) => {
          const persistedEnabled = readEnabled(settings)
          if (operation === operationRef.current) {
            if (persistedEnabled !== enabled) {
              updateView({ status: 'error', enabled: false, updating: false })
            } else {
              updateView({ status: 'ready', enabled: persistedEnabled, updating: false })
            }
          }
        })
        .catch(() => {
          if (operation === operationRef.current) {
            updateView({ status: 'error', enabled: false, updating: false })
          }
        })
        .finally(() => {
          if (operation === operationRef.current) {
            inFlightRef.current = false
          }
        })
    },
    [updateView]
  )

  useEffect(() => {
    mountedRef.current = true
    retry()

    return () => {
      mountedRef.current = false
      operationRef.current += 1
      inFlightRef.current = false
    }
  }, [retry])

  return { ...view, retry, setEnabled }
}

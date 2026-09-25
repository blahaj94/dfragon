import { useLayoutEffect } from 'react'
import { useMachine } from '@xstate/react'
import type { DeveloperSample } from '../../../preload/common/types/developer'
import { ocrSamplesMachine } from '../lib/ocr-samples-machine'

export function useOcrSamples(enabled: boolean): {
  samples: DeveloperSample[]
  loading: boolean
  error: string
  revision: number
  refresh: () => void
} {
  const [snapshot, send] = useMachine(ocrSamplesMachine, { input: { api: window.developer } })
  useLayoutEffect(() => {
    if (!enabled) {
      return
    }
    const unsubscribe = window.auth?.onAuthStateChanged((state) => {
      if (state.phase !== 'signedIn') {
        send({ type: 'SIGNED_OUT' })
      }
    })
    send({ type: 'OPEN' })
    return () => {
      unsubscribe?.()
      send({ type: 'CLOSE' })
    }
  }, [enabled, send])
  return {
    samples: enabled ? snapshot.context.samples : [],
    loading: enabled && snapshot.matches({ open: 'loading' }),
    error: snapshot.context.error,
    revision: snapshot.context.revision,
    refresh: () => send({ type: 'REFRESH' })
  }
}

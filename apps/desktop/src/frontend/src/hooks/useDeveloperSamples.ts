import { useLayoutEffect } from 'react'
import { useMachine } from '@xstate/react'
import { waitFor } from 'xstate'
import type { DeveloperSample } from '../../../preload/common/types/developer'
import { developerSamplesMachine } from '../lib/developer-samples-machine'

export function useDeveloperSamples(): {
  samples: DeveloperSample[]
  loading: boolean
  saving: boolean
  error: string
  refresh: () => Promise<void>
  addSample: (pngDataUrl: string) => Promise<DeveloperSample | null>
  saveLabel: (id: string, text: string | null) => Promise<DeveloperSample | null>
} {
  const [snapshot, send, actor] = useMachine(developerSamplesMachine, {
    input: { api: window.developer }
  })

  // Resolve public command promises before @xstate/react tears down the actor on unmount.
  useLayoutEffect(() => () => send({ type: 'CANCEL' }), [send])

  function refresh(): Promise<void> {
    const current = actor.getSnapshot()
    const event = { type: 'REFRESH', request: {} } as const
    if (!current.can(event)) {
      return Promise.resolve()
    }

    const completed = waitFor(actor, (state) => state.context.lastRefresh === event.request)
    send(event)
    return completed.then(
      () => undefined,
      () => undefined
    )
  }

  function save(
    command:
      | { type: 'ADD_SAMPLE'; pngDataUrl: string }
      | { type: 'SAVE_LABEL'; id: string; text: string | null }
  ): Promise<DeveloperSample | null> {
    const current = actor.getSnapshot()
    const event = { ...command, request: {} } as const
    if (!current.can(event)) {
      return Promise.resolve(null)
    }

    const completed = waitFor(actor, (state) => state.context.lastSave?.request === event.request)
      .then((state) => state.context.lastSave?.sample ?? null)
      .catch(() => null)
    send(event)
    return completed
  }

  return {
    samples: snapshot.context.samples,
    loading: snapshot.matches('loading'),
    saving: snapshot.matches('saving'),
    error: snapshot.context.error,
    refresh,
    addSample: (pngDataUrl) => save({ type: 'ADD_SAMPLE', pngDataUrl }),
    saveLabel: (id, text) => save({ type: 'SAVE_LABEL', id, text })
  }
}

import { useLayoutEffect } from 'react'
import { useMachine } from '@xstate/react'
import { waitFor } from 'xstate'
import { DEVELOPER_EVENTS } from '../constants/developer'
import type { DeveloperSample } from '../../../preload/common/types/developer'
import { developerSamplesMachine } from '../lib/developer-samples-machine'

export function useDeveloperSamples(): {
  samples: DeveloperSample[]
  loading: boolean
  saving: boolean
  error: string
  refresh: () => Promise<void>
  saveLabel: (id: string, text: string | null) => Promise<DeveloperSample | null>
  setSampleExcluded: (id: string, excluded: boolean) => Promise<DeveloperSample | null>
} {
  const [snapshot, send, actor] = useMachine(developerSamplesMachine, {
    input: { api: window.developer }
  })

  // Resolve public command promises before @xstate/react tears down the actor on unmount.
  useLayoutEffect(() => () => send({ type: DEVELOPER_EVENTS.CANCEL }), [send])

  function refresh(): Promise<void> {
    const current = actor.getSnapshot()
    const event = { type: DEVELOPER_EVENTS.REFRESH, request: {} } as const
    if (!current.can(event)) {
      return Promise.resolve()
    }

    const completed = waitFor(actor, (state) =>
      state.context.lastRefreshRequests.includes(event.request)
    )
    send(event)
    return completed.then(
      () => undefined,
      () => undefined
    )
  }

  function save(
    command:
      | { type: typeof DEVELOPER_EVENTS.SAVE_LABEL; id: string; text: string | null }
      | { type: typeof DEVELOPER_EVENTS.SET_SAMPLE_EXCLUDED; id: string; excluded: boolean }
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
    saveLabel: (id, text) => save({ type: DEVELOPER_EVENTS.SAVE_LABEL, id, text }),
    setSampleExcluded: (id, excluded) =>
      save({ type: DEVELOPER_EVENTS.SET_SAMPLE_EXCLUDED, id, excluded })
  }
}

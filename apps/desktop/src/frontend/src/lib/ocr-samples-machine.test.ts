import { createActor, waitFor } from 'xstate'
import { expect, it, vi } from 'vitest'
import type { DeveloperSample } from '../../../preload/common/types/developer'
import { ocrSamplesMachine } from './ocr-samples-machine'

it('sign-out clears server data, closes image access and ignores a late listing', async () => {
  let resolve!: (samples: DeveloperSample[]) => void
  const api = {
    listOcrSamples: vi.fn(
      () =>
        new Promise<DeveloperSample[]>((done) => {
          resolve = done
        })
    ),
    closeOcrSamples: vi.fn(async () => undefined)
  }
  const actor = createActor(ocrSamplesMachine, { input: { api } }).start()
  try {
    actor.send({ type: 'OPEN' })
    actor.send({ type: 'REFRESH' })
    expect(api.listOcrSamples).toHaveBeenCalledOnce()
    actor.send({ type: 'SIGNED_OUT' })
    resolve([{ id: 'stale' } as DeveloperSample])
    await Promise.resolve()
    expect(actor.getSnapshot().context.samples).toEqual([])
    expect(actor.getSnapshot().context.error).toContain('로그인')
    expect(api.closeOcrSamples).toHaveBeenCalledOnce()
    api.listOcrSamples.mockResolvedValue([])
    actor.send({ type: 'REFRESH' })
    await waitFor(actor, (state) => state.matches({ open: 'ready' }))
    expect(actor.getSnapshot().context.error).toBe('')
  } finally {
    actor.send({ type: 'CLOSE' })
    actor.stop()
  }
})

it('closing the source clears loaded answers and prevents hidden refreshes', async () => {
  const api = {
    listOcrSamples: vi.fn(async () => [{ id: 'loaded' } as DeveloperSample]),
    closeOcrSamples: vi.fn(async () => undefined)
  }
  const actor = createActor(ocrSamplesMachine, { input: { api } }).start()
  try {
    actor.send({ type: 'OPEN' })
    await waitFor(actor, (state) => state.matches({ open: 'ready' }))
    expect(actor.getSnapshot().context.samples).toHaveLength(1)
    actor.send({ type: 'CLOSE' })
    actor.send({ type: 'REFRESH' })
    expect(actor.getSnapshot().context.samples).toEqual([])
    expect(api.closeOcrSamples).toHaveBeenCalledOnce()
    expect(api.listOcrSamples).toHaveBeenCalledOnce()
  } finally {
    actor.stop()
  }
})

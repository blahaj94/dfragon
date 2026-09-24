import { createActor } from 'xstate'
import { expect, it, vi } from 'vitest'
import { developerModeMachine } from './developer-mode-machine'

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}

it('ignores a settings result after the machine actor stops', async () => {
  const read = deferred<{ enabled: boolean }>()
  const api = {
    getSettings: vi.fn(() => read.promise),
    setEnabled: vi.fn(async (enabled: boolean) => ({ enabled }))
  }
  const actor = createActor(developerModeMachine, { input: { api } }).start()

  await vi.waitFor(() => expect(api.getSettings).toHaveBeenCalledOnce())
  expect(actor.getSnapshot().value).toBe('loading')

  actor.stop()
  read.resolve({ enabled: true })
  await new Promise((resolve) => setTimeout(resolve, 0))

  expect(actor.getSnapshot().value).toBe('loading')
  expect(actor.getSnapshot().context.enabled).toBe(false)
})

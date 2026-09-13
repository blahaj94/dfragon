import { expect, it, vi } from 'vitest'
import type { CredentialStore } from '../../src/backend/auth/types'
import { createObserver, type Observation } from './observer'
import { traceStore } from './trace-store'

it('reports an actual store success separately from the adapter return before awaiting its ACK', async () => {
  const events: Observation[] = []
  const removeTransition = vi.fn(async () => 'confirmed' as const)
  const observer = createObserver({
    runId: 'run',
    caseId: 'normal-control',
    timeoutMs: 100,
    exchange: async (event) => {
      events.push(event)
      return event
    }
  })
  const store = traceStore({
    store: { removeTransition } as unknown as CredentialStore,
    observer,
    scenario: () => 'replace.finalize'
  })
  expect(await store.removeTransition()).toBe('confirmed')
  expect(removeTransition).toHaveBeenCalledTimes(1)
  expect(
    events.map(({ cutpoint, phase, outcome, detail }) => ({ cutpoint, phase, outcome, detail }))
  ).toEqual([
    {
      cutpoint: 'store.removeTransition',
      phase: 'protocol-start',
      outcome: 'not-called',
      detail: { scenario: 'replace.finalize' }
    },
    {
      cutpoint: 'store.removeTransition',
      phase: 'protocol-return',
      outcome: 'confirmed',
      detail: { scenario: 'replace.finalize' }
    }
  ])
})
it('does not invoke a store mutation when its start ACK is missing', async () => {
  const clearCredential = vi.fn()
  const observer = createObserver({
    runId: 'run',
    caseId: 'normal-control',
    timeoutMs: 100,
    exchange: async () => null
  })
  const store = traceStore({
    store: { clearCredential } as unknown as CredentialStore,
    observer,
    scenario: () => 'clear'
  })
  await expect(store.clearCredential()).rejects.toThrow('ACK')
  expect(clearCredential).not.toHaveBeenCalled()
})

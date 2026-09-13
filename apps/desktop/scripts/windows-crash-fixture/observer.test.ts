import { afterEach, expect, it, vi } from 'vitest'
import { createObserver, observeBeforeRecovery, type Observation } from './observer'

const identity = { runId: 'synthetic-run', caseId: 'replace' }
const point = { cutpoint: 'adapter.rename', phase: 'after', outcome: 'returned' } as const

afterEach(() => vi.useRealTimers())

it.each(['runId', 'caseId', 'sequence', 'cutpoint', 'phase', 'outcome'] as const)(
  'rejects mismatched ACK %s and permanently blocks later mutations',
  async (field) => {
    const exchange = vi.fn(async (event: Observation) => ({ ...event, [field]: 'incorrect' }))
    const observer = createObserver({ ...identity, exchange, timeoutMs: 100 })

    await expect(observer.observe(point)).rejects.toThrow('ACK')
    expect(() => observer.assertActive()).toThrow()
    await expect(observer.observe(point)).rejects.toThrow()
    expect(exchange).toHaveBeenCalledTimes(1)
  }
)

it('rejects a duplicate ACK from the preceding observation', async () => {
  let previous: Observation | undefined
  const exchange = vi.fn(async (event: Observation) => {
    previous ??= event
    return previous
  })
  const observer = createObserver({ ...identity, exchange, timeoutMs: 100 })

  await observer.observe(point)
  await expect(observer.observe(point)).rejects.toThrow('ACK')
  expect(() => observer.assertActive()).toThrow()
})

it('does not permit mutations while an ACK is pending', async () => {
  let acknowledge: (event: Observation) => void = () => undefined
  let pending: Observation | undefined
  const exchange = (event: Observation): Promise<unknown> => {
    pending = event
    return new Promise((resolve) => {
      acknowledge = resolve
    })
  }
  const observer = createObserver({ ...identity, exchange, timeoutMs: 100 })

  const observation = observer.observe(point)
  expect(() => observer.assertActive()).toThrow()
  acknowledge(pending!)
  await observation
  expect(() => observer.assertActive()).not.toThrow()
})

it('fails closed on observer timeout or disconnect', async () => {
  vi.useFakeTimers()
  const observer = createObserver({
    ...identity,
    timeoutMs: 100,
    exchange: () => new Promise(() => undefined)
  })
  const observation = expect(observer.observe(point)).rejects.toThrow('ACK')
  await vi.advanceTimersByTimeAsync(100)
  await observation
  expect(() => observer.assertActive()).toThrow()

  const disconnected = createObserver({
    ...identity,
    timeoutMs: 100,
    exchange: async () => {
      throw new Error('disconnected')
    }
  })
  await expect(disconnected.observe(point)).rejects.toThrow()
  expect(() => disconnected.assertActive()).toThrow()
})

it('collects original disk and receives its ACK before invoking store inspection', async () => {
  const actions: string[] = []
  const inspect = vi.fn(async () => {
    actions.push('inspect-may-prepare')
    return { status: 'empty' }
  })
  const snapshot = vi.fn(async () => {
    actions.push('read-only-disk')
    return { files: [] }
  })
  const observer = createObserver({
    ...identity,
    timeoutMs: 100,
    exchange: async (event) => {
      actions.push('host-ack')
      return event
    }
  })

  await observeBeforeRecovery({ observer, snapshot, inspect })
  expect(actions).toEqual(['read-only-disk', 'host-ack', 'inspect-may-prepare'])
})

it('keeps recovery mutation count zero when original observation or ACK fails', async () => {
  const inspect = vi.fn()
  const observer = createObserver({ ...identity, timeoutMs: 100, exchange: async () => null })

  await expect(
    observeBeforeRecovery({ observer, snapshot: async () => ({ files: [] }), inspect })
  ).rejects.toThrow()
  expect(inspect).not.toHaveBeenCalled()

  const healthy = createObserver({ ...identity, timeoutMs: 100, exchange: async (event) => event })
  await expect(
    observeBeforeRecovery({
      observer: healthy,
      snapshot: async () => {
        throw new Error('unconfirmed disk')
      },
      inspect
    })
  ).rejects.toThrow('unconfirmed disk')
  expect(inspect).not.toHaveBeenCalled()
})

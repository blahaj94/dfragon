import { describe, expect, it, vi } from 'vitest'
import { createActor } from 'xstate'
import { createPendingLogin, type PendingLogin } from './pending-login'
import { pendingLoginMachine } from './pending-login-machine'
import { ATTEMPT_ID, CODE, OTHER_CODE, REQUEST_ID, FakeClock, deferred } from './auth-test-fixtures'
import type { AuthClock, ClockReading } from './types'

function createAttempt(clock = new FakeClock()): {
  pending: PendingLogin
  clock: FakeClock
  onExpired: ReturnType<typeof vi.fn>
  acceptRequest: (expiresIn?: number) => void
} {
  const onExpired = vi.fn()
  const pending = createPendingLogin(
    {
      attemptId: ATTEMPT_ID,
      provider: 'passkey',
      generation: 1,
      verifier: 'test-verifier',
      startedAt: clock.read()
    },
    clock,
    onExpired
  )
  pending.start()
  const acceptRequest = (expiresIn = 300_000): void => {
    pending.acceptRequest({
      requestId: REQUEST_ID,
      expiresAt: new Date(clock.wallMs + expiresIn).toISOString(),
      browserUrl: 'https://api.example.test/auth/login/authorize'
    })
  }
  return { pending, clock, onExpired, acceptRequest }
}

describe('pending login actor', () => {
  it('publishes recovery before another microtask can claim the next code', async () => {
    const { pending, acceptRequest } = createAttempt()
    acceptRequest()
    pending.claimExchange(CODE, () => ({ completion: Promise.resolve() }))
    const cleanup = deferred<boolean>()
    let published = false
    const recovery = pending.rejectExchange(
      () => cleanup.promise,
      () => {
        published = true
      }
    )
    cleanup.resolve(true)
    await Promise.resolve()
    const claim = pending.claimExchange(OTHER_CODE, () => {
      expect(published).toBe(true)
      return { completion: Promise.resolve() }
    })
    expect(claim.status).toBe('claimed')
    await recovery
    pending.dispose()
  })

  it('allows expiry disposal to abort resources before the coordinator publishes signedOut', () => {
    const clock = new FakeClock()
    const order: string[] = []
    const pending = createPendingLogin(
      {
        attemptId: ATTEMPT_ID,
        provider: 'passkey',
        generation: 1,
        verifier: 'test',
        startedAt: clock.read()
      },
      clock,
      (expired) => {
        expect(expired.isBeforeExchange).toBe(false)
        order.push('invalidate')
        expired.dispose()
        order.push('signedOut')
      }
    )
    pending.signal.addEventListener('abort', () => order.push('abort'))
    pending.browserSignal.addEventListener('abort', () => order.push('browserAbort'))
    pending.start()
    clock.advance(600_000)
    expect(order).toEqual(['invalidate', 'abort', 'browserAbort', 'signedOut'])
  })

  it('claims synchronously, shares the reserved completion, and rejects a code before recovery', async () => {
    const { pending, acceptRequest } = createAttempt()
    const initialSignal = pending.signal
    const exchange = deferred<void>()
    const writer = { completion: exchange.promise }
    const reserve = vi.fn(() => writer)
    expect(pending.claimExchange(CODE, reserve)).toEqual({ status: 'ignored' })
    expect(reserve).not.toHaveBeenCalled()

    acceptRequest()
    const claim = pending.claimExchange(CODE, reserve)
    expect(claim).toEqual({
      status: 'claimed',
      input: {
        requestId: REQUEST_ID,
        clientId: 'desktop',
        code: CODE,
        codeVerifier: 'test-verifier'
      },
      signal: pending.signal,
      writer
    })
    expect(pending.signal).not.toBe(initialSignal)
    expect(pending.isBeforeExchange).toBe(false)
    expect(pending.claimExchange(CODE, reserve)).toEqual({
      status: 'joined',
      promise: exchange.promise
    })
    expect(pending.claimExchange(OTHER_CODE, reserve)).toEqual({ status: 'ignored' })
    expect(reserve).toHaveBeenCalledTimes(1)

    const cleanup = deferred<boolean>()
    const recovery = pending.rejectExchange(() => cleanup.promise, vi.fn())
    expect(pending.claimExchange(CODE, reserve)).toEqual({ status: 'ignored' })
    expect(pending.claimExchange(OTHER_CODE, reserve)).toEqual({ status: 'ignored' })
    cleanup.resolve(true)
    expect(await recovery).toBe(true)
    expect(pending.isBeforeExchange).toBe(true)
    expect(pending.claimExchange(CODE, reserve)).toEqual({ status: 'ignored' })
    const nextWriter = { completion: Promise.resolve() }
    expect(pending.claimExchange(OTHER_CODE, () => nextWriter).status).toBe('claimed')
    expect(pending.claimExchange(OTHER_CODE, reserve)).toEqual({
      status: 'joined',
      promise: nextWriter.completion
    })
    exchange.resolve()
    await exchange.promise
    pending.dispose()
  })

  it('keeps the synchronous claim closed during publication and respects cancellation before reservation', () => {
    const { pending, acceptRequest } = createAttempt()
    acceptRequest()
    const secondReserve = vi.fn(() => ({ completion: Promise.resolve() }))
    const claim = pending.claimExchange(CODE, () => {
      expect(pending.claimExchange(CODE, secondReserve)).toEqual({ status: 'ignored' })
      pending.dispose()
      return null
    })
    expect(claim).toEqual({ status: 'ignored' })
    expect(secondReserve).not.toHaveBeenCalled()
  })

  it('does not resume a disposed attempt after delayed rejection recovery', async () => {
    const { pending, acceptRequest } = createAttempt()
    acceptRequest()
    pending.claimExchange(CODE, () => ({ completion: Promise.resolve() }))
    const cleanup = deferred<boolean>()
    const recovery = pending.rejectExchange(() => cleanup.promise, vi.fn())
    pending.dispose()
    cleanup.resolve(true)
    expect(await recovery).toBe(false)
    expect(pending.isBeforeExchange).toBe(false)
  })

  it.each(['starting', 'waiting', 'exchanging'] as const)(
    'disposal in %s cancels expiry and aborts the HTTP and browser lifetimes once',
    (stage) => {
      const { pending, clock, onExpired, acceptRequest } = createAttempt()
      if (stage !== 'starting') {
        acceptRequest()
      }
      if (stage === 'exchanging') {
        pending.claimExchange(CODE, () => ({ completion: Promise.resolve() }))
      }
      const onAbort = vi.fn()
      const onBrowserAbort = vi.fn()
      pending.signal.addEventListener('abort', onAbort)
      pending.browserSignal.addEventListener('abort', onBrowserAbort)
      pending.start()

      pending.dispose()
      pending.dispose()
      acceptRequest()
      pending.start()
      clock.advance(600_000)

      expect(onAbort).toHaveBeenCalledTimes(1)
      expect(onBrowserAbort).toHaveBeenCalledTimes(1)
      expect(onExpired).not.toHaveBeenCalled()
      expect(clock.scheduled.every((task) => task.cancelled)).toBe(true)
      expect(pending.claimExchange(CODE, () => ({ completion: Promise.resolve() }))).toEqual({
        status: 'ignored'
      })
      expect(pending.isBeforeExchange).toBe(false)
    }
  )

  it('publishes disposal before abort listeners reenter scheduling or claiming', () => {
    const { pending, clock, acceptRequest } = createAttempt()
    acceptRequest()
    const reentrantClaim = vi.fn()
    pending.signal.addEventListener('abort', () => {
      expect(pending.isBeforeExchange).toBe(false)
      pending.start()
      reentrantClaim(pending.claimExchange(CODE, () => ({ completion: Promise.resolve() })))
    })

    pending.dispose()

    expect(reentrantClaim).toHaveBeenCalledExactlyOnceWith({ status: 'ignored' })
    expect(clock.scheduled).toHaveLength(2)
    expect(clock.scheduled.every((task) => task.cancelled)).toBe(true)
  })

  it.each([60_000, 900_000])(
    'expires at the earliest server expiry or ten-minute limit (%i)',
    (ttl) => {
      const { pending, clock, onExpired, acceptRequest } = createAttempt()
      acceptRequest(ttl)
      const expectedLifetime = Math.min(ttl, 600_000)
      clock.advance(expectedLifetime - 1)
      expect(onExpired).not.toHaveBeenCalled()
      clock.advance(1)
      expect(onExpired).toHaveBeenCalledExactlyOnceWith(pending)
      expect(pending.signal.aborted).toBe(true)
      expect(pending.browserSignal.aborted).toBe(true)
      expect(pending.claimExchange(CODE, () => ({ completion: Promise.resolve() }))).toEqual({
        status: 'ignored'
      })
      clock.advance(600_000)
      expect(onExpired).toHaveBeenCalledTimes(1)
    }
  )

  it.each(['wall', 'monotonic', 'discontinuous'] as const)(
    'rejects %s clock trust loss against the most recent accepted reading',
    (kind) => {
      const { pending, clock, acceptRequest } = createAttempt()
      clock.elapseWithoutTimers(100)
      expect(pending.isExpired(clock.read())).toBe(false)
      if (kind === 'wall') {
        clock.wallMs -= 1
      }
      if (kind === 'monotonic') {
        clock.monotonicMs -= 1
      }
      if (kind === 'discontinuous') {
        clock.discontinuous = true
      }
      expect(pending.isExpired(clock.read())).toBe(true)
      acceptRequest()
      expect(pending.signal.aborted).toBe(true)
    }
  )

  it('reschedules an early timer without extending the original deadline', () => {
    const { pending, clock, onExpired } = createAttempt()
    clock.elapseWithoutTimers(100)
    clock.scheduled[0].callback()
    expect(clock.scheduled[0].cancelled).toBe(true)
    expect(clock.scheduled[1].at).toBe(601_000)
    clock.advance(599_900)
    expect(onExpired).toHaveBeenCalledExactlyOnceWith(pending)
  })

  it('cancels a timer returned after the clock synchronously expires the attempt', () => {
    const startedAt: ClockReading = { wallMs: 1_000, monotonicMs: 1_000, discontinuous: false }
    const cancel = vi.fn()
    const read = vi.fn().mockReturnValueOnce(startedAt).mockReturnValue({
      wallMs: 601_000,
      monotonicMs: 601_000,
      discontinuous: false
    })
    const clock: AuthClock = {
      read,
      schedule: (_delay, callback) => {
        callback()
        return cancel
      }
    }
    const onExpired = vi.fn()
    const pending = createPendingLogin(
      { attemptId: ATTEMPT_ID, provider: 'passkey', generation: 1, verifier: 'test', startedAt },
      clock,
      onExpired
    )
    pending.start()
    expect(onExpired).toHaveBeenCalledExactlyOnceWith(pending)
    expect(cancel).toHaveBeenCalledExactlyOnceWith()
  })

  it('starts monitoring only after activation and cancels a timer returned after synchronous disposal', () => {
    const startedAt: ClockReading = { wallMs: 1_000, monotonicMs: 1_000, discontinuous: false }
    const cancel = vi.fn()
    const schedule = vi.fn(() => {
      pending.dispose()
      return cancel
    })
    const pending = createPendingLogin(
      { attemptId: ATTEMPT_ID, provider: 'passkey', generation: 1, verifier: 'test', startedAt },
      { read: () => startedAt, schedule },
      vi.fn()
    )
    expect(schedule).not.toHaveBeenCalled()
    pending.start()
    expect(cancel).toHaveBeenCalledExactlyOnceWith()
    expect(pending.signal.aborted).toBe(true)
  })

  it('publishes terminal expiry before the expiration callback can claim or reactivate', () => {
    const { pending, clock, onExpired, acceptRequest } = createAttempt()
    acceptRequest()
    const reserve = vi.fn(() => ({ completion: Promise.resolve() }))
    onExpired.mockImplementation(() => {
      expect(pending.isBeforeExchange).toBe(false)
      expect(pending.claimExchange(CODE, reserve)).toEqual({ status: 'ignored' })
      pending.start()
    })
    clock.advance(300_000)
    expect(onExpired).toHaveBeenCalledTimes(1)
    expect(reserve).not.toHaveBeenCalled()
    expect(clock.scheduled.every((task) => task.cancelled)).toBe(true)
  })

  it('the terminal actor releases request, fingerprint and joined Promise references', () => {
    const actor = createActor(pendingLoginMachine, {
      input: { startedAt: new FakeClock().read() }
    }).start()
    actor.send({ type: 'START' })
    actor.send({
      type: 'REQUEST_ACCEPTED',
      requestId: REQUEST_ID,
      expiresAt: '2026-09-06T12:10:00Z'
    })
    actor.send({ type: 'CLAIM', fingerprint: 'test-fingerprint' })
    actor.send({ type: 'TRACK_EXCHANGE', promise: Promise.resolve() })
    actor.send({ type: 'EXCHANGE_REJECTED' })
    actor.send({ type: 'DISPOSE' })
    expect(actor.getSnapshot().status).toBe('done')
    expect(actor.getSnapshot().context).toMatchObject({
      requestId: null,
      exchangeFingerprint: null,
      rejectedFingerprint: null,
      exchangePromise: null
    })
  })
})

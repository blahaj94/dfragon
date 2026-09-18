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
  it('claims synchronously once, joins only the tracked matching exchange, and retries a different code', async () => {
    const { pending, acceptRequest } = createAttempt()
    const initialSignal = pending.signal
    expect(pending.claim(CODE)).toEqual({ status: 'ignored' })
    expect(pending.isBeforeExchange).toBe(true)

    acceptRequest()
    const claim = pending.claim(CODE)
    expect(claim).toEqual({
      status: 'claimed',
      input: {
        requestId: REQUEST_ID,
        clientId: 'desktop',
        code: CODE,
        codeVerifier: 'test-verifier'
      },
      signal: pending.signal
    })
    expect(pending.signal).not.toBe(initialSignal)
    expect(pending.isBeforeExchange).toBe(false)
    expect(pending.claim(CODE)).toEqual({ status: 'ignored' })

    const exchange = deferred<void>()
    pending.trackExchange(exchange.promise)
    expect(pending.claim(CODE)).toEqual({ status: 'joined', promise: exchange.promise })
    expect(pending.claim(OTHER_CODE)).toEqual({ status: 'ignored' })

    pending.rejectCode(CODE)
    expect(pending.claim(CODE)).toEqual({ status: 'ignored' })
    pending.resumeWaiting()
    expect(pending.isBeforeExchange).toBe(true)
    expect(pending.claim(CODE)).toEqual({ status: 'ignored' })
    expect(pending.claim(OTHER_CODE).status).toBe('claimed')
    // The previous exchange must not be joined before the new writer is tracked.
    expect(pending.claim(OTHER_CODE)).toEqual({ status: 'ignored' })
    exchange.resolve()
    await exchange.promise
    pending.dispose()
  })

  it.each(['starting', 'waiting', 'exchanging'] as const)(
    'disposal in %s cancels expiry and aborts the HTTP and browser lifetimes once',
    (stage) => {
      const { pending, clock, onExpired, acceptRequest } = createAttempt()
      if (stage !== 'starting') {
        acceptRequest()
      }
      if (stage === 'exchanging') {
        pending.claim(CODE)
      }
      const onAbort = vi.fn()
      const onBrowserAbort = vi.fn()
      pending.signal.addEventListener('abort', onAbort)
      pending.browserSignal.addEventListener('abort', onBrowserAbort)
      pending.scheduleExpiry()

      pending.dispose()
      pending.dispose()
      acceptRequest()
      pending.resumeWaiting()
      pending.scheduleExpiry()
      clock.advance(600_000)

      expect(onAbort).toHaveBeenCalledTimes(1)
      expect(onBrowserAbort).toHaveBeenCalledTimes(1)
      expect(onExpired).not.toHaveBeenCalled()
      expect(clock.scheduled.every((task) => task.cancelled)).toBe(true)
      expect(pending.claim(CODE)).toEqual({ status: 'ignored' })
      expect(pending.isBeforeExchange).toBe(false)
    }
  )

  it('publishes disposal before abort listeners reenter scheduling or claiming', () => {
    const { pending, clock, acceptRequest } = createAttempt()
    acceptRequest()
    pending.scheduleExpiry()
    const reentrantClaim = vi.fn()
    pending.signal.addEventListener('abort', () => {
      expect(pending.isBeforeExchange).toBe(false)
      pending.scheduleExpiry()
      reentrantClaim(pending.claim(CODE))
    })

    pending.dispose()

    expect(reentrantClaim).toHaveBeenCalledExactlyOnceWith({ status: 'ignored' })
    expect(clock.scheduled).toHaveLength(1)
    expect(clock.scheduled[0].cancelled).toBe(true)
  })

  it.each([60_000, 900_000])(
    'expires at the earliest server expiry or ten-minute limit (%i)',
    (ttl) => {
      const { pending, clock, onExpired, acceptRequest } = createAttempt()
      pending.scheduleExpiry()
      acceptRequest(ttl)
      pending.scheduleExpiry()
      const expectedLifetime = Math.min(ttl, 600_000)
      clock.advance(expectedLifetime - 1)
      expect(onExpired).not.toHaveBeenCalled()
      clock.advance(1)
      expect(onExpired).toHaveBeenCalledExactlyOnceWith(pending)
      expect(pending.signal.aborted).toBe(true)
      expect(pending.browserSignal.aborted).toBe(true)
      expect(pending.claim(CODE)).toEqual({ status: 'ignored' })
      clock.advance(600_000)
      expect(onExpired).toHaveBeenCalledTimes(1)
    }
  )

  it.each(['wall', 'monotonic', 'discontinuous'] as const)(
    'rejects %s clock trust loss against the most recent accepted reading',
    (kind) => {
      const { pending, clock } = createAttempt()
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
      pending.scheduleExpiry()
      expect(pending.signal.aborted).toBe(true)
    }
  )

  it('reschedules an early timer without extending the original deadline', () => {
    const { pending, clock, onExpired } = createAttempt()
    pending.scheduleExpiry()
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
    pending.scheduleExpiry()
    expect(onExpired).toHaveBeenCalledExactlyOnceWith(pending)
    expect(cancel).toHaveBeenCalledExactlyOnceWith()
  })

  it('the terminal actor releases request, fingerprint and joined Promise references', () => {
    const actor = createActor(pendingLoginMachine, {
      input: { startedAt: new FakeClock().read() }
    }).start()
    actor.send({
      type: 'REQUEST_ACCEPTED',
      requestId: REQUEST_ID,
      expiresAt: '2026-09-06T12:10:00Z'
    })
    actor.send({ type: 'CLAIM', fingerprint: 'test-fingerprint', reply: vi.fn() })
    actor.send({ type: 'TRACK_EXCHANGE', promise: Promise.resolve() })
    actor.send({ type: 'REJECT_CODE', fingerprint: 'rejected-fingerprint' })
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

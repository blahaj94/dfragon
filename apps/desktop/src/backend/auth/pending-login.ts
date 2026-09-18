import { createHash } from 'node:crypto'
import { createActor } from 'xstate'
import {
  isPendingLoginExpired,
  pendingLoginExpiryDelay,
  pendingLoginMachine,
  type ExchangeDecision
} from './pending-login-machine'
import type {
  AuthClock,
  AuthHttp,
  AuthProvider,
  AuthSnapshot,
  ClockReading,
  LoginRequestResponse
} from './types'

type PendingLoginInput = Readonly<{
  attemptId: string
  provider: AuthProvider
  verifier: string
  generation: number
  startedAt: ClockReading
}>

export type ClaimedExchange = Readonly<{
  status: 'claimed'
  input: Parameters<AuthHttp['exchange']>[0]
  signal: AbortSignal
}>

type ExchangeClaim = Exclude<ExchangeDecision, { status: 'claimed' }> | ClaimedExchange

export type PendingLogin = Readonly<{
  attemptId: string
  provider: AuthProvider
  generation: number
  browserSignal: AbortSignal
  signal: AbortSignal
  isBeforeExchange: boolean
  snapshot(): NonNullable<AuthSnapshot['login']>
  acceptRequest(response: LoginRequestResponse): void
  isExpired(checkedAt: ClockReading): boolean
  scheduleExpiry(): void
  claim(code: string): ExchangeClaim
  trackExchange(promise: Promise<void>): void
  rejectCode(code: string): void
  resumeWaiting(): void
  dispose(): void
}>

function fingerprint(value: string): string {
  return createHash('sha256').update(value, 'ascii').digest('base64url')
}

export function createPendingLogin(
  { attemptId, provider, generation, startedAt, verifier: initialVerifier }: PendingLoginInput,
  clock: AuthClock,
  onExpired: (attempt: PendingLogin) => void
): PendingLogin {
  // Secrets and abort/timer resources stay outside actor snapshots and events.
  let verifier: string | null = initialVerifier
  initialVerifier = ''
  let controller = new AbortController()
  const lifetime = new AbortController()
  let cancelExpiry: (() => void) | null = null
  const actor = createActor(pendingLoginMachine, { input: { startedAt } })
  actor.subscribe({
    complete: () => {
      // Publish the terminal state before abort listeners can reenter this attempt.
      verifier = null
      cancelExpiry?.()
      cancelExpiry = null
      controller.abort()
      lifetime.abort()
    }
  })
  actor.start()

  function isExpired(checkedAt: ClockReading): boolean {
    const expired = isPendingLoginExpired(actor.getSnapshot().context, checkedAt)
    if (!expired) {
      actor.send({ type: 'CLOCK_ACCEPTED', checkedAt })
    }
    return expired
  }

  function expire(): void {
    onExpired(pending)
    actor.send({ type: 'EXPIRE' })
  }

  function scheduleExpiry(): void {
    cancelExpiry?.()
    cancelExpiry = null
    if (actor.getSnapshot().status === 'done') {
      return
    }
    const checkedAt = clock.read()
    if (isExpired(checkedAt)) {
      expire()
      return
    }

    const delayMs = pendingLoginExpiryDelay(actor.getSnapshot().context, checkedAt)
    const cancel = clock.schedule(delayMs, () => {
      if (actor.getSnapshot().status === 'done') {
        return
      }
      const firedAt = clock.read()
      if (isExpired(firedAt)) {
        expire()
      } else {
        scheduleExpiry()
      }
    })
    if (actor.getSnapshot().status === 'done') {
      cancel()
    } else {
      cancelExpiry = cancel
    }
  }

  const pending: PendingLogin = {
    attemptId,
    provider,
    generation,
    get browserSignal() {
      return lifetime.signal
    },
    get signal() {
      return controller.signal
    },
    get isBeforeExchange() {
      const snapshot = actor.getSnapshot()
      return snapshot.matches({ active: 'starting' }) || snapshot.matches({ active: 'waiting' })
    },
    snapshot: () => ({ attemptId, provider, expiresAt: actor.getSnapshot().context.expiresAt }),
    acceptRequest: ({ requestId, expiresAt }) => {
      actor.send({ type: 'REQUEST_ACCEPTED', requestId, expiresAt })
    },
    isExpired,
    scheduleExpiry,
    claim: (code) => {
      const response: { decision: ExchangeDecision } = { decision: { status: 'ignored' } }
      actor.send({
        type: 'CLAIM',
        fingerprint: fingerprint(code),
        reply: (value) => {
          response.decision = value
        }
      })
      const result = response.decision
      if (result.status !== 'claimed') {
        return result
      }
      const requestId = actor.getSnapshot().context.requestId
      if (requestId == null || verifier == null) {
        return { status: 'ignored' }
      }
      controller = new AbortController()
      return {
        status: 'claimed',
        input: { requestId, clientId: 'desktop', code, codeVerifier: verifier },
        signal: controller.signal
      }
    },
    trackExchange: (promise) => actor.send({ type: 'TRACK_EXCHANGE', promise }),
    rejectCode: (code) => actor.send({ type: 'REJECT_CODE', fingerprint: fingerprint(code) }),
    resumeWaiting: () => actor.send({ type: 'RESUME_WAITING' }),
    dispose: () => actor.send({ type: 'DISPOSE' })
  }
  return pending
}

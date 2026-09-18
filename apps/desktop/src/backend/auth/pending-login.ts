import { createHash } from 'node:crypto'
import { createActor } from 'xstate'
import {
  isPendingLoginExpired,
  pendingLoginExpiryDelay,
  createPendingExpiry
} from './pending-login-expiry'
import { pendingLoginMachine } from './pending-login-machine'
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

type ExchangeClaim<Writer> =
  | Readonly<{ status: 'ignored' }>
  | Readonly<{ status: 'joined'; promise: Promise<void> }>
  | (ClaimedExchange & Readonly<{ writer: Writer }>)

export type PendingLogin = Readonly<{
  attemptId: string
  provider: AuthProvider
  generation: number
  browserSignal: AbortSignal
  signal: AbortSignal
  isBeforeExchange: boolean
  snapshot(): NonNullable<AuthSnapshot['login']>
  start(): void
  acceptRequest(response: LoginRequestResponse): void
  isExpired(checkedAt: ClockReading): boolean
  claimExchange<Writer extends Readonly<{ completion: Promise<void> }>>(
    code: string,
    reserve: () => Writer | null
  ): ExchangeClaim<Writer>
  rejectExchange(recover: () => Promise<boolean>, onRecovered: () => void): Promise<boolean>
  dispose(): void
}>

export function createPendingLogin(
  { attemptId, provider, generation, startedAt, verifier: initialVerifier }: PendingLoginInput,
  clock: AuthClock,
  onExpired: (attempt: PendingLogin) => void
): PendingLogin {
  // Secrets and abort resources stay outside actor snapshots and events.
  let verifier: string | null = initialVerifier
  initialVerifier = ''
  let controller = new AbortController()
  const lifetime = new AbortController()
  const actor = createActor(
    pendingLoginMachine.provide({
      actors: {
        expiry: createPendingExpiry(clock, isExpired, (checkedAt) =>
          pendingLoginExpiryDelay(actor.getSnapshot().context, checkedAt)
        )
      }
    }),
    { input: { startedAt } }
  )
  actor.subscribe({
    complete: () => {
      // The terminal snapshot is visible before coordinator or abort listeners reenter.
      verifier = null
      if (actor.getSnapshot().context.expired) {
        onExpired(pending)
      }
      releaseResources()
    }
  })
  actor.start()

  function releaseResources(): void {
    verifier = null
    controller.abort()
    lifetime.abort()
  }

  function isExpired(checkedAt: ClockReading): boolean {
    const expired = isPendingLoginExpired(actor.getSnapshot().context, checkedAt)
    if (!expired) {
      actor.send({ type: 'CLOCK_ACCEPTED', checkedAt })
    }
    return expired
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
      return (
        snapshot.matches('idle') ||
        snapshot.matches({ active: 'starting' }) ||
        snapshot.matches({ active: 'waiting' })
      )
    },
    snapshot: () => ({ attemptId, provider, expiresAt: actor.getSnapshot().context.expiresAt }),
    start: () => actor.send({ type: 'START' }),
    acceptRequest: ({ requestId, expiresAt }) => {
      if (!actor.getSnapshot().matches({ active: 'starting' })) {
        return
      }
      actor.send({ type: 'REQUEST_ACCEPTED', requestId, expiresAt })
      if (isExpired(clock.read())) {
        actor.send({ type: 'EXPIRE' })
      } else {
        actor.send({ type: 'RESCHEDULE_EXPIRY' })
      }
    },
    isExpired,
    claimExchange: (code, reserve) => {
      const snapshot = actor.getSnapshot()
      const fingerprint = createHash('sha256').update(code, 'ascii').digest('base64url')
      const { requestId, rejectedFingerprint, exchangeFingerprint, exchangePromise } =
        snapshot.context
      if (rejectedFingerprint === fingerprint) {
        return { status: 'ignored' }
      }
      if (snapshot.matches({ active: 'exchanging' })) {
        return exchangeFingerprint === fingerprint && exchangePromise != null
          ? { status: 'joined', promise: exchangePromise }
          : { status: 'ignored' }
      }
      const claim = { type: 'CLAIM' as const, fingerprint }
      if (!snapshot.can(claim) || requestId == null || verifier == null) {
        return { status: 'ignored' }
      }
      actor.send(claim)
      controller = new AbortController()
      const input = { requestId, clientId: 'desktop' as const, code, codeVerifier: verifier }
      // Publication and its current-attempt check must precede reserving the writer.
      const writer = reserve()
      if (writer == null) {
        return { status: 'ignored' }
      }
      actor.send({ type: 'TRACK_EXCHANGE', promise: writer.completion })
      return { status: 'claimed', input, signal: controller.signal, writer }
    },
    rejectExchange: async (recover, onRecovered) => {
      const snapshot = actor.getSnapshot()
      if (!snapshot.matches({ active: 'exchanging' })) {
        return false
      }
      const exchangePromise = snapshot.context.exchangePromise
      actor.send({ type: 'EXCHANGE_REJECTED' })
      if (!(await recover())) {
        return false
      }
      const recovered = actor.getSnapshot()
      if (
        !recovered.matches({ active: 'exchanging' }) ||
        recovered.context.exchangePromise !== exchangePromise
      ) {
        return false
      }
      actor.send({ type: 'RESUME_WAITING' })
      // Publish in this continuation before a new code can claim the waiting attempt.
      onRecovered()
      return true
    },
    dispose: () => {
      actor.send({ type: 'DISPOSE' })
      // Expiry notifies the coordinator after terminal publication. Its disposal must
      // still abort resources before it publishes signedOut or starts another attempt.
      if (actor.getSnapshot().status === 'done') {
        releaseResources()
      }
    }
  }
  return pending
}

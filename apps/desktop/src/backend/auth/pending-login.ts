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
  LoginRequestResponse,
  LoginReturnListener
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
  lifetimeSignal: AbortSignal
  returnUrl: string | null
  attachListener(listener: LoginReturnListener): void
  closeListener(): void
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
  let listener: LoginReturnListener | null = null
  let returnUrl: string | null = null
  let controller = new AbortController()
  const lifetime = new AbortController()
  const actor = createActor(
    pendingLoginMachine.provide({
      actors: {
        expiry: createPendingExpiry(clock, isExpired, (checkedAt): number =>
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
    pending.closeListener()
    returnUrl = null
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
    get lifetimeSignal() {
      return lifetime.signal
    },
    get returnUrl() {
      return returnUrl
    },
    attachListener: (opened) => {
      if (lifetime.signal.aborted) {
        opened.close()

        return
      }
      listener = opened
      returnUrl = opened.returnUrl
    },
    closeListener: () => {
      const current = listener
      listener = null
      current?.close()
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
    snapshot: () => {
      const expiresAt = actor.getSnapshot().context.expiresAt

      return { attemptId, provider, expiresAt }
    },
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
      const { requestId, exchangeFingerprint, exchangePromise } = snapshot.context

      if (snapshot.matches({ active: 'exchanging' })) {
        if (exchangeFingerprint === fingerprint && exchangePromise != null) {
          return { status: 'joined', promise: exchangePromise }
        }

        return { status: 'ignored' }
      }
      const claim = { type: 'CLAIM' as const, fingerprint }
      if (!snapshot.can(claim) || requestId == null || verifier == null) {
        return { status: 'ignored' }
      }
      actor.send(claim)
      pending.closeListener()
      controller = new AbortController()
      const input = { requestId, clientId: 'desktop' as const, code, codeVerifier: verifier }
      // Publication and its current-attempt check must precede reserving the writer.
      const writer = reserve()
      if (writer == null) {
        return { status: 'ignored' }
      }
      actor.send({ type: 'TRACK_EXCHANGE', promise: writer.completion })
      const signal = controller.signal

      return { status: 'claimed', input, signal, writer }
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

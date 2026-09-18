import { assign, setup } from 'xstate'
import type { ClockReading } from './types'

const LOGIN_REQUEST_MAX_AGE_MS = 600_000

export type ExchangeDecision =
  | Readonly<{ status: 'ignored' }>
  | Readonly<{ status: 'joined'; promise: Promise<void> }>
  | Readonly<{ status: 'claimed' }>

type PendingLoginContext = {
  startedAt: ClockReading
  lastAcceptedAt: ClockReading
  requestId: string | null
  expiresAt: string | null
  expiresAtMs: number | null
  rejectedFingerprint: string | null
  exchangeFingerprint: string | null
  exchangePromise: Promise<void> | null
}

type PendingLoginEvent =
  | { type: 'REQUEST_ACCEPTED'; requestId: string; expiresAt: string }
  | { type: 'CLOCK_ACCEPTED'; checkedAt: ClockReading }
  | { type: 'CLAIM'; fingerprint: string; reply: (decision: ExchangeDecision) => void }
  | { type: 'TRACK_EXCHANGE'; promise: Promise<void> }
  | { type: 'REJECT_CODE'; fingerprint: string }
  | { type: 'RESUME_WAITING' }
  | { type: 'EXPIRE' }
  | { type: 'DISPOSE' }

// Keep the clock reads in their original order, including the optional server comparison.
export function isPendingLoginExpired(
  { startedAt, lastAcceptedAt, expiresAtMs }: PendingLoginContext,
  checkedAt: ClockReading
): boolean {
  const isWallClockReversed = checkedAt.wallMs < lastAcceptedAt.wallMs
  const isMonotonicReversed = checkedAt.monotonicMs < lastAcceptedAt.monotonicMs
  const hasReachedMonotonicLimit =
    checkedAt.monotonicMs - startedAt.monotonicMs >= LOGIN_REQUEST_MAX_AGE_MS
  if (expiresAtMs != null) {
    const hasReachedServerExpiry = checkedAt.wallMs >= expiresAtMs
    const hasExpiredClock =
      startedAt.discontinuous ||
      checkedAt.discontinuous ||
      isWallClockReversed ||
      isMonotonicReversed ||
      hasReachedMonotonicLimit
    return hasExpiredClock || hasReachedServerExpiry
  }
  return (
    startedAt.discontinuous ||
    checkedAt.discontinuous ||
    isWallClockReversed ||
    isMonotonicReversed ||
    hasReachedMonotonicLimit
  )
}

export function pendingLoginExpiryDelay(
  { startedAt, expiresAtMs }: PendingLoginContext,
  checkedAt: ClockReading
): number {
  const monotonicRemaining =
    startedAt.monotonicMs + LOGIN_REQUEST_MAX_AGE_MS - checkedAt.monotonicMs
  const wallRemaining = expiresAtMs != null ? expiresAtMs - checkedAt.wallMs : monotonicRemaining
  return Math.max(0, Math.min(monotonicRemaining, wallRemaining))
}

export const pendingLoginMachine = setup({
  types: {
    context: {} as PendingLoginContext,
    input: {} as { startedAt: ClockReading },
    events: {} as PendingLoginEvent
  }
}).createMachine({
  id: 'pendingLogin',
  context: ({ input }) => ({
    startedAt: input.startedAt,
    lastAcceptedAt: input.startedAt,
    requestId: null,
    expiresAt: null,
    expiresAtMs: null,
    rejectedFingerprint: null,
    exchangeFingerprint: null,
    exchangePromise: null
  }),
  initial: 'active',
  states: {
    active: {
      initial: 'starting',
      on: {
        DISPOSE: '#pendingLogin.disposed',
        EXPIRE: '#pendingLogin.disposed',
        CLOCK_ACCEPTED: {
          actions: assign({ lastAcceptedAt: ({ event }) => event.checkedAt })
        },
        REJECT_CODE: {
          actions: assign({ rejectedFingerprint: ({ event }) => event.fingerprint })
        },
        CLAIM: { actions: ({ event }) => event.reply({ status: 'ignored' }) }
      },
      states: {
        starting: {
          on: {
            REQUEST_ACCEPTED: {
              target: 'waiting',
              actions: assign(({ event }) => ({
                requestId: event.requestId,
                expiresAt: event.expiresAt,
                expiresAtMs: Date.parse(event.expiresAt)
              }))
            }
          }
        },
        waiting: {
          on: {
            CLAIM: {
              guard: ({ context, event }) =>
                context.requestId != null && context.rejectedFingerprint !== event.fingerprint,
              target: 'exchanging',
              actions: [
                assign({ exchangeFingerprint: ({ event }) => event.fingerprint }),
                ({ event }) => event.reply({ status: 'claimed' })
              ]
            }
          }
        },
        exchanging: {
          on: {
            CLAIM: {
              actions: ({ context, event }) => {
                const canJoin =
                  context.rejectedFingerprint !== event.fingerprint &&
                  context.exchangeFingerprint === event.fingerprint &&
                  context.exchangePromise != null
                event.reply(
                  canJoin && context.exchangePromise != null
                    ? { status: 'joined', promise: context.exchangePromise }
                    : { status: 'ignored' }
                )
              }
            },
            TRACK_EXCHANGE: {
              actions: assign({ exchangePromise: ({ event }) => event.promise })
            },
            RESUME_WAITING: {
              target: 'waiting',
              actions: assign({ exchangeFingerprint: null, exchangePromise: null })
            }
          }
        }
      }
    },
    disposed: {
      type: 'final',
      entry: assign({
        requestId: null,
        rejectedFingerprint: null,
        exchangeFingerprint: null,
        exchangePromise: null
      })
    }
  }
})

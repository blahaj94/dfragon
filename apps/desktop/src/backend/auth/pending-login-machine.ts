import { assign, fromCallback, sendTo, setup } from 'xstate'
import type { ClockReading } from './types'

type PendingLoginContext = {
  startedAt: ClockReading
  lastAcceptedAt: ClockReading
  requestId: string | null
  expiresAt: string | null
  expiresAtMs: number | null
  rejectedFingerprint: string | null
  exchangeFingerprint: string | null
  exchangePromise: Promise<void> | null
  expired: boolean
}

type PendingLoginEvent =
  | { type: 'REQUEST_ACCEPTED'; requestId: string; expiresAt: string }
  | { type: 'CLOCK_ACCEPTED'; checkedAt: ClockReading }
  | { type: 'START' }
  | { type: 'RESCHEDULE_EXPIRY' }
  | { type: 'CLAIM'; fingerprint: string }
  | { type: 'TRACK_EXCHANGE'; promise: Promise<void> }
  | { type: 'EXCHANGE_REJECTED' }
  | { type: 'RESUME_WAITING' }
  | { type: 'EXPIRE' }
  | { type: 'DISPOSE' }

export const pendingLoginMachine = setup({
  actors: {
    expiry: fromCallback<{ type: 'RESCHEDULE' }>(() => undefined)
  },
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
    exchangePromise: null,
    expired: false
  }),
  initial: 'idle',
  states: {
    idle: { on: { START: 'active', DISPOSE: 'disposed' } },
    active: {
      invoke: { id: 'expiry', src: 'expiry' },
      initial: 'starting',
      on: {
        DISPOSE: '#pendingLogin.disposed',
        EXPIRE: {
          target: '#pendingLogin.disposed',
          actions: assign({ expired: true })
        },
        RESCHEDULE_EXPIRY: { actions: sendTo('expiry', { type: 'RESCHEDULE' }) },
        CLOCK_ACCEPTED: {
          actions: assign({ lastAcceptedAt: ({ event }) => event.checkedAt })
        }
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
              actions: assign({ exchangeFingerprint: ({ event }) => event.fingerprint })
            }
          }
        },
        exchanging: {
          on: {
            EXCHANGE_REJECTED: {
              actions: assign({ rejectedFingerprint: ({ context }) => context.exchangeFingerprint })
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

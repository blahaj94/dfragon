import { assign, setup } from 'xstate'
import type { PendingLogin } from './pending-login'
import type { RecoveryPurpose, StorageRecoveryPurpose } from './recovery-plan'
import type { AuthAuthorization, AuthCommandResult, AuthNotice, AuthSnapshot } from './types'

export type VerificationOperation = Readonly<{ controller: AbortController }>

export type AuthFlight<T> = Readonly<{ promise: Promise<T> }>
type RefreshFlight = AuthFlight<AuthAuthorization> & Readonly<{ generation: number }>
type StorageNotice = 'SECURE_STORAGE_UNAVAILABLE' | 'LOCAL_CLEAR_UNCONFIRMED' | 'TOKEN_SAVE_FAILED'
type PausedNotice = 'NETWORK_UNAVAILABLE' | 'AUTH_SERVICE_UNAVAILABLE' | 'RESTORE_RETRY_REQUIRED'

type CoordinatorContext = {
  revision: number
  hasStartedRefresh: boolean
  verification: VerificationOperation | null
  generation: number
  pending: PendingLogin | null
  login: AuthSnapshot['login']
  user: AuthSnapshot['user']
  entry: AuthSnapshot['entry']
  notice: AuthNotice | null
  recoveryPurpose: RecoveryPurpose | null
  start: AuthFlight<AuthSnapshot> | null
  refresh: RefreshFlight | null
  logout: AuthFlight<AuthCommandResult> | null
}

export type CoordinatorEvent =
  | { type: 'INVALIDATE' }
  | { type: 'REFRESH_STARTED' }
  | { type: 'VERIFY'; operation: VerificationOperation }
  | { type: 'VERIFIED'; operation: VerificationOperation }
  | { type: 'ABORT_VERIFICATION' }
  | { type: 'BIND_PENDING'; pending: PendingLogin }
  | { type: 'RELEASE_PENDING'; pending: PendingLogin }
  | { type: 'LOGIN_STARTED'; login: NonNullable<AuthSnapshot['login']> }
  | {
      type: 'BROWSER_READY'
      login: NonNullable<AuthSnapshot['login']>
      notice: 'LOGIN_RETURN_INVALID' | null
    }
  | { type: 'EXCHANGE_STARTED'; login: NonNullable<AuthSnapshot['login']> }
  | { type: 'SIGNED_IN'; nickname: string; entry: 'welcome' | 'home' }
  | { type: 'SIGNED_OUT'; notice: AuthNotice | null }
  | { type: 'RESTORING' }
  | { type: 'RESTORE_PAUSED'; notice: PausedNotice }
  | { type: 'SIGNING_OUT' }
  | { type: 'STORAGE_BLOCKED'; notice: StorageNotice; purpose: StorageRecoveryPurpose }
  | { type: 'START'; flight: AuthFlight<AuthSnapshot> }
  | { type: 'START_SETTLED'; flight: AuthFlight<AuthSnapshot> }
  | { type: 'REFRESH'; flight: RefreshFlight }
  | { type: 'REFRESH_SETTLED'; flight: RefreshFlight }
  | { type: 'LOGOUT'; flight: AuthFlight<AuthCommandResult> }
  | { type: 'LOGOUT_SETTLED'; flight: AuthFlight<AuthCommandResult> }

// Public phase, generation ownership and operation reservations change synchronously.
// Credential I/O is deliberately allowed to finish after invalidation: its writer must
// still dispose late tokens and establish durable cleanup before another writer starts.
export const authCoordinatorMachine = setup({
  types: {
    context: {} as CoordinatorContext,
    events: {} as CoordinatorEvent
  },
  actions: {
    publish: assign(({ context, event }) => {
      if (context.revision === Number.MAX_SAFE_INTEGER) {
        throw new Error('Auth snapshot revision is exhausted.')
      }
      const inactive = { login: null, user: null, entry: null }
      const revision = context.revision + 1
      switch (event.type) {
        case 'LOGIN_STARTED':
        case 'EXCHANGE_STARTED':
        case 'BROWSER_READY':
          return {
            revision,
            login: event.login,
            user: null,
            entry: null,
            notice: event.type === 'BROWSER_READY' ? event.notice : null,
            recoveryPurpose: null
          }
        case 'SIGNED_IN':
          return {
            revision,
            login: null,
            user: { nickname: event.nickname },
            entry: event.entry,
            notice: null,
            recoveryPurpose: null
          }
        case 'SIGNED_OUT':
          return { ...inactive, revision, notice: event.notice, recoveryPurpose: null }
        case 'RESTORING':
          return { ...inactive, revision, notice: null }
        case 'RESTORE_PAUSED':
          return {
            ...inactive,
            revision,
            notice: event.notice,
            recoveryPurpose: 'resume-credential' as const
          }
        case 'SIGNING_OUT':
          return { ...inactive, revision, notice: null, recoveryPurpose: null }
        case 'STORAGE_BLOCKED':
          return { ...inactive, revision, notice: event.notice, recoveryPurpose: event.purpose }
        default:
          return {}
      }
    })
  }
}).createMachine({
  id: 'authCoordinator',
  type: 'parallel',
  context: {
    revision: 0,
    hasStartedRefresh: false,
    verification: null,
    generation: 0,
    pending: null,
    login: null,
    user: null,
    entry: null,
    notice: null,
    recoveryPurpose: null,
    start: null,
    refresh: null,
    logout: null
  },
  on: {
    REFRESH_STARTED: { actions: assign({ hasStartedRefresh: true }) },
    VERIFY: { actions: assign({ verification: ({ event }) => event.operation }) },
    VERIFIED: {
      guard: ({ context, event }) => context.verification === event.operation,
      actions: assign({ verification: null })
    },
    ABORT_VERIFICATION: { actions: ({ context }) => context.verification?.controller.abort() },
    INVALIDATE: { actions: assign({ generation: ({ context }) => context.generation + 1 }) },
    BIND_PENDING: { actions: assign({ pending: ({ event }) => event.pending }) },
    RELEASE_PENDING: {
      guard: ({ context, event }) => context.pending === event.pending,
      actions: assign({ pending: null })
    }
  },
  states: {
    phase: {
      initial: 'restoring',
      on: {
        SIGNED_OUT: { target: '.signedOut', actions: 'publish' },
        SIGNING_OUT: { target: '.signingOut', actions: 'publish' },
        STORAGE_BLOCKED: { target: '.storageBlocked', actions: 'publish' }
      },
      states: {
        restoring: {
          on: {
            SIGNED_IN: { target: 'signedIn', actions: 'publish' },
            RESTORE_PAUSED: { target: 'restorePaused', actions: 'publish' }
          }
        },
        signedOut: { on: { LOGIN_STARTED: { target: 'startingLogin', actions: 'publish' } } },
        startingLogin: { on: { BROWSER_READY: { target: 'waitingBrowser', actions: 'publish' } } },
        waitingBrowser: {
          on: { EXCHANGE_STARTED: { target: 'exchanging', actions: 'publish' } }
        },
        exchanging: {
          on: {
            BROWSER_READY: { target: 'waitingBrowser', actions: 'publish' },
            SIGNED_IN: { target: 'signedIn', actions: 'publish' }
          }
        },
        signedIn: {
          on: { RESTORE_PAUSED: { target: 'restorePaused', actions: 'publish' } }
        },
        restorePaused: { on: { RESTORING: { target: 'restoring', actions: 'publish' } } },
        storageBlocked: { on: { RESTORING: { target: 'restoring', actions: 'publish' } } },
        signingOut: {}
      }
    },
    startup: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            START: {
              target: 'running',
              actions: assign({ start: ({ event }) => event.flight })
            }
          }
        },
        running: {
          on: {
            START_SETTLED: {
              target: 'complete',
              guard: ({ context, event }) => context.start === event.flight
            }
          }
        },
        complete: {}
      }
    },
    refresh: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            REFRESH: {
              target: 'running',
              actions: assign({ refresh: ({ event }) => event.flight })
            }
          }
        },
        running: {
          on: {
            REFRESH: {
              guard: ({ context, event }) =>
                context.refresh?.generation !== event.flight.generation,
              actions: assign({ refresh: ({ event }) => event.flight })
            },
            REFRESH_SETTLED: {
              target: 'idle',
              guard: ({ context, event }) => context.refresh === event.flight,
              actions: assign({ refresh: null })
            }
          }
        }
      }
    },
    logout: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            LOGOUT: {
              target: 'running',
              actions: assign({ logout: ({ event }) => event.flight })
            }
          }
        },
        running: {
          on: {
            LOGOUT_SETTLED: {
              target: 'idle',
              guard: ({ context, event }) => context.logout === event.flight,
              actions: assign({ logout: null })
            }
          }
        }
      }
    }
  }
})

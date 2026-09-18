import type { ActorRefFrom } from 'xstate'
import type { authCoordinatorMachine, CoordinatorEvent } from './coordinator-machine'
import type { RecoveryPurpose, StorageRecoveryPurpose } from './recovery-plan'
import type {
  AuthCommandError,
  AuthCommandResult,
  AuthNotice,
  AuthPhase,
  AuthProvider,
  AuthSnapshot
} from './types'

type LoginSnapshot = NonNullable<AuthSnapshot['login']>
type StorageNotice = 'SECURE_STORAGE_UNAVAILABLE' | 'LOCAL_CLEAR_UNCONFIRMED' | 'TOKEN_SAVE_FAILED'
type PausedNotice = 'NETWORK_UNAVAILABLE' | 'AUTH_SERVICE_UNAVAILABLE' | 'RESTORE_RETRY_REQUIRED'

export type AuthState = Readonly<{
  phase: AuthPhase
  recoveryPurpose: RecoveryPurpose | null
  getSnapshot(): AuthSnapshot
  subscribe(listener: (snapshot: AuthSnapshot) => void): () => void
  success(current?: AuthSnapshot): AuthCommandResult
  failure(code: AuthCommandError): AuthCommandResult
  loginStarted(login: LoginSnapshot): AuthSnapshot
  waitingForBrowser(login: LoginSnapshot, notice?: 'LOGIN_RETURN_INVALID' | null): AuthSnapshot
  exchangeStarted(login: LoginSnapshot): AuthSnapshot
  signedIn(nickname: string, entry: 'welcome' | 'home'): AuthSnapshot
  signedOut(notice?: AuthNotice | null): AuthSnapshot
  restoring(): AuthSnapshot
  restorePaused(notice: PausedNotice): AuthSnapshot
  signingOut(): AuthSnapshot
  storageBlocked(notice: StorageNotice, purpose: StorageRecoveryPurpose): AuthSnapshot
}>

export function createAuthState(
  actor: ActorRefFrom<typeof authCoordinatorMachine>,
  runId: string,
  providers: readonly AuthProvider[]
): AuthState {
  const listeners = new Set<(snapshot: AuthSnapshot) => void>()

  function getSnapshot(): AuthSnapshot {
    const { context, value } = actor.getSnapshot()
    const login = context.login
    const user = context.user
    return {
      runId,
      revision: context.revision,
      phase: value.phase as AuthPhase,
      providers: [...providers],
      login: login
        ? { attemptId: login.attemptId, provider: login.provider, expiresAt: login.expiresAt }
        : null,
      user: user ? { nickname: user.nickname } : null,
      entry: context.entry,
      notice: context.notice
    }
  }

  function publish(event: CoordinatorEvent): AuthSnapshot {
    const previousRevision = actor.getSnapshot().context.revision
    actor.send(event)
    const published = getSnapshot()
    if (published.revision === previousRevision) {
      return published
    }
    // Emit outside the actor mailbox: a consumer may synchronously cancel/logout,
    // and the caller must observe that new generation before starting its next effect.
    for (const listener of listeners) {
      try {
        listener(published)
      } catch {
        // Consumer failure cannot roll back committed main-process state.
      }
    }
    return published
  }

  return {
    getSnapshot,
    subscribe(listener: (snapshot: AuthSnapshot) => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    get phase(): AuthPhase {
      return actor.getSnapshot().value.phase as AuthPhase
    },
    get recoveryPurpose() {
      return actor.getSnapshot().context.recoveryPurpose
    },
    success(current = getSnapshot()): AuthCommandResult {
      return { ok: true, snapshot: current }
    },
    failure(code: AuthCommandError): AuthCommandResult {
      return { ok: false, error: { code }, snapshot: getSnapshot() }
    },
    loginStarted(login: NonNullable<AuthSnapshot['login']>): AuthSnapshot {
      return publish({ type: 'LOGIN_STARTED', login })
    },
    waitingForBrowser(
      login: NonNullable<AuthSnapshot['login']>,
      notice: 'LOGIN_RETURN_INVALID' | null = null
    ): AuthSnapshot {
      return publish({ type: 'BROWSER_READY', login, notice })
    },
    exchangeStarted(login: NonNullable<AuthSnapshot['login']>): AuthSnapshot {
      return publish({ type: 'EXCHANGE_STARTED', login })
    },
    signedIn(nickname: string, entry: 'welcome' | 'home'): AuthSnapshot {
      return publish({ type: 'SIGNED_IN', nickname, entry })
    },
    signedOut(notice: AuthNotice | null = null): AuthSnapshot {
      return publish({ type: 'SIGNED_OUT', notice })
    },
    restoring(): AuthSnapshot {
      return publish({ type: 'RESTORING' })
    },
    restorePaused(
      notice: 'NETWORK_UNAVAILABLE' | 'AUTH_SERVICE_UNAVAILABLE' | 'RESTORE_RETRY_REQUIRED'
    ): AuthSnapshot {
      return publish({ type: 'RESTORE_PAUSED', notice })
    },
    signingOut(): AuthSnapshot {
      return publish({ type: 'SIGNING_OUT' })
    },
    storageBlocked(
      notice: 'SECURE_STORAGE_UNAVAILABLE' | 'LOCAL_CLEAR_UNCONFIRMED' | 'TOKEN_SAVE_FAILED',
      purpose: StorageRecoveryPurpose
    ): AuthSnapshot {
      return publish({ type: 'STORAGE_BLOCKED', notice, purpose })
    }
  }
}

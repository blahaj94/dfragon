import { createActor } from 'xstate'
import { authCoordinatorMachine } from './coordinator-machine'
import type { AuthFlight, CoordinatorEvent, VerificationOperation } from './coordinator-machine'
import type { PendingLogin } from './pending-login'
import type { RecoveryPurpose, StorageRecoveryPurpose } from './recovery-plan'
import type {
  AuthAuthorization,
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
  generation: number
  pending: PendingLogin | null
  logoutFlight: Promise<AuthCommandResult> | null
  hasStartedRefresh: boolean
  getSnapshot(): AuthSnapshot
  subscribe(listener: (snapshot: AuthSnapshot) => void): () => void
  advanceGeneration(): void
  bindPending(pending: PendingLogin): void
  releasePending(pending: PendingLogin): void
  start(operation: () => Promise<AuthSnapshot>): Promise<AuthSnapshot>
  currentRefresh(generation: number): Promise<AuthAuthorization> | null
  shareRefresh(
    generation: number,
    operation: () => Promise<AuthAuthorization>
  ): Promise<AuthAuthorization>
  markRefreshStarted(): void
  reserveVerification(): VerificationOperation
  completeVerification(operation: VerificationOperation): void
  abortVerification(): void
  shareLogout(operation: () => Promise<AuthCommandResult>): Promise<AuthCommandResult>
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

// Reserve before invoking I/O so synchronous consumers cannot launch a second flight.
function runFlight<T>(
  flight: AuthFlight<T>,
  operation: () => Promise<T>,
  resolve: (value: T) => void,
  reject: (reason: unknown) => void,
  settled: () => void
): Promise<T> {
  void flight.promise.then(settled, settled)
  try {
    void operation().then(resolve, reject)
  } catch (error) {
    reject(error)
  }
  return flight.promise
}

export function createAuthState(runId: string, providers: readonly AuthProvider[]): AuthState {
  const actor = createActor(authCoordinatorMachine).start()
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

  function currentRefresh(generation: number): Promise<AuthAuthorization> | null {
    const flight = actor.getSnapshot().context.refresh
    return flight?.generation === generation ? flight.promise : null
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
    get generation(): number {
      return actor.getSnapshot().context.generation
    },
    advanceGeneration(): void {
      actor.send({ type: 'INVALIDATE' })
    },
    get pending(): PendingLogin | null {
      return actor.getSnapshot().context.pending
    },
    bindPending(pending: PendingLogin): void {
      actor.send({ type: 'BIND_PENDING', pending })
    },
    releasePending(pending: PendingLogin): void {
      actor.send({ type: 'RELEASE_PENDING', pending })
    },
    get logoutFlight(): Promise<AuthCommandResult> | null {
      return actor.getSnapshot().context.logout?.promise ?? null
    },
    start(operation: () => Promise<AuthSnapshot>): Promise<AuthSnapshot> {
      const existing = actor.getSnapshot().context.start
      if (existing) {
        return existing.promise
      }
      let resolve!: (value: AuthSnapshot) => void
      let reject!: (reason: unknown) => void
      const flight = {
        promise: new Promise<AuthSnapshot>((onResolve, onReject) => {
          resolve = onResolve
          reject = onReject
        })
      }
      actor.send({ type: 'START', flight })
      return runFlight(flight, operation, resolve, reject, () => {
        actor.send({ type: 'START_SETTLED', flight })
      })
    },
    currentRefresh,
    get hasStartedRefresh(): boolean {
      return actor.getSnapshot().context.hasStartedRefresh
    },
    markRefreshStarted(): void {
      actor.send({ type: 'REFRESH_STARTED' })
    },
    reserveVerification(): VerificationOperation {
      const operation = { controller: new AbortController() }
      actor.send({ type: 'VERIFY', operation })
      return operation
    },
    completeVerification(operation: VerificationOperation): void {
      actor.send({ type: 'VERIFIED', operation })
    },
    abortVerification(): void {
      actor.send({ type: 'ABORT_VERIFICATION' })
    },
    shareRefresh(
      generation: number,
      operation: () => Promise<AuthAuthorization>
    ): Promise<AuthAuthorization> {
      const existing = currentRefresh(generation)
      if (existing) {
        return existing
      }
      let resolve!: (value: AuthAuthorization) => void
      let reject!: (reason: unknown) => void
      const flight = {
        generation,
        promise: new Promise<AuthAuthorization>((onResolve, onReject) => {
          resolve = onResolve
          reject = onReject
        })
      }
      actor.send({ type: 'REFRESH', flight })
      return runFlight(flight, operation, resolve, reject, () => {
        actor.send({ type: 'REFRESH_SETTLED', flight })
      })
    },
    shareLogout(operation: () => Promise<AuthCommandResult>): Promise<AuthCommandResult> {
      const existing = actor.getSnapshot().context.logout
      if (existing) {
        return existing.promise
      }
      let resolve!: (value: AuthCommandResult) => void
      let reject!: (reason: unknown) => void
      const flight = {
        promise: new Promise<AuthCommandResult>((onResolve, onReject) => {
          resolve = onResolve
          reject = onReject
        })
      }
      actor.send({ type: 'LOGOUT', flight })
      return runFlight(flight, operation, resolve, reject, () => {
        actor.send({ type: 'LOGOUT_SETTLED', flight })
      })
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

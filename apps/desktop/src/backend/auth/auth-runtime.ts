import { createActor } from 'xstate'
import { createAuthState } from './auth-state'
import type { AuthState } from './auth-state'
import { authCoordinatorMachine } from './coordinator-machine'
import type { VerificationOperation } from './coordinator-machine'
import type { PendingLogin } from './pending-login'
import type { AuthAuthorization, AuthCommandResult, AuthProvider, AuthSnapshot } from './types'

export type AuthRuntime = Readonly<{
  state: AuthState
  generation: number
  pending: PendingLogin | null
  logoutFlight: Promise<AuthCommandResult> | null
  hasStartedRefresh: boolean
  invalidate(): number
  bindPending(pending: PendingLogin): void
  releasePending(pending: PendingLogin): void
  cancelPending(pending: PendingLogin): void
  invalidateForLogout(): number
  start(operation: () => Promise<AuthSnapshot>): Promise<AuthSnapshot>
  currentRefresh(generation: number): Promise<AuthAuthorization> | null
  shareRefresh(
    generation: number,
    operation: () => Promise<AuthAuthorization>
  ): Promise<AuthAuthorization>
  markRefreshStarted(): void
  reserveVerification(): VerificationOperation
  completeVerification(operation: VerificationOperation): void
  shareLogout(operation: () => Promise<AuthCommandResult>): Promise<AuthCommandResult>
}>

// Reserve before invoking I/O so synchronous consumers cannot launch a second flight.
function runFlight<T>(
  operation: () => Promise<T>,
  reserve: (promise: Promise<T>) => void,
  settled: (promise: Promise<T>) => void
): Promise<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  reserve(promise)
  void promise.then(
    () => settled(promise),
    () => settled(promise)
  )
  try {
    void operation().then(resolve, reject)
  } catch (error) {
    reject(error)
  }
  return promise
}

export function createAuthRuntime(runId: string, providers: readonly AuthProvider[]): AuthRuntime {
  // The machine is the sole owner of state and reservations. Runtime executes
  // effects outside its mailbox so synchronous abort/listener reentry is visible.
  const actor = createActor(authCoordinatorMachine).start()
  const state = createAuthState(actor, runId, providers)

  function invalidate(): number {
    actor.send({ type: 'INVALIDATE' })
    return actor.getSnapshot().context.generation
  }

  function releasePending(pending: PendingLogin): void {
    pending.dispose()
    // Disposal can synchronously replace the attempt; the machine checks identity.
    actor.send({ type: 'RELEASE_PENDING', pending })
  }

  function currentRefresh(generation: number): Promise<AuthAuthorization> | null {
    const flight = actor.getSnapshot().context.refresh
    return flight?.generation === generation ? flight.promise : null
  }

  return {
    state,
    get generation(): number {
      return actor.getSnapshot().context.generation
    },
    invalidate,
    get pending(): PendingLogin | null {
      return actor.getSnapshot().context.pending
    },
    bindPending(pending: PendingLogin): void {
      actor.send({ type: 'BIND_PENDING', pending })
    },
    releasePending,
    cancelPending(pending: PendingLogin): void {
      invalidate()
      releasePending(pending)
    },
    invalidateForLogout(): number {
      const pending = actor.getSnapshot().context.pending
      const generation = invalidate()
      if (pending != null) {
        releasePending(pending)
      }
      actor.getSnapshot().context.verification?.controller.abort()
      return generation
    },
    get logoutFlight(): Promise<AuthCommandResult> | null {
      return actor.getSnapshot().context.logout
    },
    start(operation: () => Promise<AuthSnapshot>): Promise<AuthSnapshot> {
      const existing = actor.getSnapshot().context.start
      if (existing) {
        return existing
      }
      return runFlight(
        operation,
        (flight) => actor.send({ type: 'START', flight }),
        (flight) => actor.send({ type: 'START_SETTLED', flight })
      )
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
    shareRefresh(
      generation: number,
      operation: () => Promise<AuthAuthorization>
    ): Promise<AuthAuthorization> {
      const existing = currentRefresh(generation)
      if (existing) {
        return existing
      }
      return runFlight(
        operation,
        (promise) => actor.send({ type: 'REFRESH', flight: { generation, promise } }),
        (promise) => actor.send({ type: 'REFRESH_SETTLED', promise })
      )
    },
    shareLogout(operation: () => Promise<AuthCommandResult>): Promise<AuthCommandResult> {
      const existing = actor.getSnapshot().context.logout
      if (existing) {
        return existing
      }
      return runFlight(
        operation,
        (flight) => actor.send({ type: 'LOGOUT', flight }),
        (flight) => actor.send({ type: 'LOGOUT_SETTLED', flight })
      )
    }
  }
}

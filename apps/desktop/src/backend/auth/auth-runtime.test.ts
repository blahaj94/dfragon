import { describe, expect, it, vi } from 'vitest'
import { createAuthRuntime } from './auth-runtime'
import type { AuthAuthorization, AuthCommandResult, AuthSnapshot } from './types'

const RUN_ID = '00000000-0000-4000-8000-000000000001'

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolveValue) => {
    resolve = resolveValue
  })
  return { promise, resolve }
}

describe('Auth runtime operation ownership', () => {
  it('reserves startup before synchronous I/O reentry and retains its completed result', async () => {
    const runtime = createAuthRuntime(RUN_ID, ['passkey'])
    const state = runtime.state
    const completed = deferred<AuthSnapshot>()
    const duplicate = vi.fn(async () => state.getSnapshot())
    let reentrant: Promise<AuthSnapshot> | undefined
    const first = runtime.start(() => {
      reentrant = runtime.start(duplicate)
      return completed.promise
    })

    expect(reentrant).toBe(first)
    expect(duplicate).not.toHaveBeenCalled()
    const signedOut = state.signedOut()
    completed.resolve(signedOut)
    await expect(first).resolves.toBe(signedOut)
    expect(runtime.start(duplicate)).toBe(first)
    expect(duplicate).not.toHaveBeenCalled()
  })

  it('reserves logout before synchronous reentry and releases a rejected operation', async () => {
    const runtime = createAuthRuntime(RUN_ID, ['passkey'])
    const state = runtime.state
    const duplicate = vi.fn(async () => state.success())
    const failure = new Error('Synthetic operation failure')
    let reentrant: Promise<AuthCommandResult> | undefined
    const first = runtime.shareLogout(() => {
      reentrant = runtime.shareLogout(duplicate)
      throw failure
    })

    expect(reentrant).toBe(first)
    expect(duplicate).not.toHaveBeenCalled()
    await expect(first).rejects.toBe(failure)
    expect(runtime.logoutFlight).toBeNull()
    await expect(runtime.shareLogout(duplicate)).resolves.toEqual(state.success())
    expect(duplicate).toHaveBeenCalledOnce()
  })

  it('reserves refresh before synchronous reentry and keeps the next generation reserved', async () => {
    const runtime = createAuthRuntime(RUN_ID, ['passkey'])
    const previous = deferred<AuthAuthorization>()
    const replacement = deferred<AuthAuthorization>()
    const duplicate = vi.fn(() => replacement.promise)
    let reentrant: Promise<AuthAuthorization> | undefined
    const first = runtime.shareRefresh(1, () => {
      reentrant = runtime.shareRefresh(1, duplicate)
      return previous.promise
    })

    expect(reentrant).toBe(first)
    expect(duplicate).not.toHaveBeenCalled()
    const next = runtime.shareRefresh(2, duplicate)
    previous.resolve({ status: 'unavailable' })
    await first
    expect(runtime.currentRefresh(1)).toBeNull()
    expect(runtime.currentRefresh(2)).toBe(next)

    replacement.resolve({ status: 'unavailable' })
    await next
    expect(runtime.currentRefresh(2)).toBeNull()
  })

  it('makes listener invalidation visible before snapshot publication returns', () => {
    const runtime = createAuthRuntime(RUN_ID, ['passkey'])
    const state = runtime.state
    state.signedOut()
    state.subscribe((snapshot) => {
      if (snapshot.phase === 'startingLogin') {
        runtime.invalidate()
        state.signedOut('LOGIN_CANCELLED')
      }
    })

    const published = state.loginStarted({
      attemptId: RUN_ID,
      provider: 'passkey',
      expiresAt: null
    })

    expect(published.phase).toBe('startingLogin')
    expect(runtime.generation).toBe(1)
    expect(state.getSnapshot()).toMatchObject({ phase: 'signedOut', notice: 'LOGIN_CANCELLED' })
  })

  it('does not let completion of an old verification release its replacement cancellation', () => {
    const runtime = createAuthRuntime(RUN_ID, ['passkey'])
    const previous = runtime.reserveVerification()
    const replacement = runtime.reserveVerification()

    runtime.completeVerification(previous)
    runtime.invalidateForLogout()

    expect(previous.controller.signal.aborted).toBe(false)
    expect(replacement.controller.signal.aborted).toBe(true)
  })
})

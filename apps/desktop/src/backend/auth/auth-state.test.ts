import { describe, expect, it, vi } from 'vitest'
import { createAuthState } from './auth-state'
import type { AuthCommandResult, AuthSnapshot } from './types'

const RUN_ID = '00000000-0000-4000-8000-000000000001'

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolveValue) => {
    resolve = resolveValue
  })
  return { promise, resolve }
}

describe('Auth coordinator operation ownership', () => {
  it('reserves startup before synchronous I/O reentry and retains its completed result', async () => {
    const state = createAuthState(RUN_ID, ['passkey'])
    const completed = deferred<AuthSnapshot>()
    const duplicate = vi.fn(async () => state.getSnapshot())
    let reentrant: Promise<AuthSnapshot> | undefined
    const first = state.start(() => {
      reentrant = state.start(duplicate)
      return completed.promise
    })

    expect(reentrant).toBe(first)
    expect(duplicate).not.toHaveBeenCalled()
    const signedOut = state.signedOut()
    completed.resolve(signedOut)
    await expect(first).resolves.toBe(signedOut)
    expect(state.start(duplicate)).toBe(first)
    expect(duplicate).not.toHaveBeenCalled()
  })

  it('reserves logout before synchronous reentry and releases a rejected operation', async () => {
    const state = createAuthState(RUN_ID, ['passkey'])
    const duplicate = vi.fn(async () => state.success())
    const failure = new Error('Synthetic operation failure')
    let reentrant: Promise<AuthCommandResult> | undefined
    const first = state.shareLogout(() => {
      reentrant = state.shareLogout(duplicate)
      throw failure
    })

    expect(reentrant).toBe(first)
    expect(duplicate).not.toHaveBeenCalled()
    await expect(first).rejects.toBe(failure)
    expect(state.logoutFlight).toBeNull()
    await expect(state.shareLogout(duplicate)).resolves.toEqual(state.success())
    expect(duplicate).toHaveBeenCalledOnce()
  })

  it('does not let completion of an old verification release its replacement cancellation', () => {
    const state = createAuthState(RUN_ID, ['passkey'])
    const previous = state.reserveVerification()
    const replacement = state.reserveVerification()

    state.completeVerification(previous)
    state.abortVerification()

    expect(previous.controller.signal.aborted).toBe(false)
    expect(replacement.controller.signal.aborted).toBe(true)
  })
})

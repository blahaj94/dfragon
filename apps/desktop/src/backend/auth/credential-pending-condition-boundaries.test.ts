import { describe, expect, it, vi } from 'vitest'
import { CredentialSession } from './credential-session'
import { createAuthRuntime } from './auth-runtime'
import { REFRESH_0, REFRESH_1, REFRESH_2, createAuthHarness, deferred } from './auth-test-fixtures'
import type { AuthAuthorization } from './types'

describe('refresh 작업의 generation 소유권', () => {
  it('같은 generation의 refresh flight만 기존 Promise를 공유한다', async () => {
    const runtime = createAuthRuntime('refresh-boundary-run', ['passkey'])
    const first = deferred<AuthAuthorization>()
    const second = deferred<AuthAuthorization>()
    const startFirst = vi.fn(() => first.promise)
    const startSecond = vi.fn(() => second.promise)

    const firstFlight = runtime.shareRefresh(1, startFirst)
    expect(runtime.currentRefresh(1)).toBe(firstFlight)
    expect(runtime.currentRefresh(2)).toBeNull()

    const joinedFlight = runtime.shareRefresh(1, startSecond)
    expect(joinedFlight).toBe(firstFlight)
    expect(startSecond).not.toHaveBeenCalled()

    const nextFlight = runtime.shareRefresh(2, startSecond)
    expect(nextFlight).not.toBe(firstFlight)
    expect(runtime.currentRefresh(1)).toBeNull()
    expect(runtime.currentRefresh(2)).toBe(nextFlight)
    expect(startFirst).toHaveBeenCalledTimes(1)
    expect(startSecond).toHaveBeenCalledTimes(1)

    first.resolve({ status: 'unavailable' })
    second.resolve({ status: 'unavailable' })
    await Promise.all([firstFlight, nextFlight])
    expect(runtime.currentRefresh(2)).toBeNull()
  })
})

describe('credential 폐기와 로그아웃의 수명', () => {
  it('같은 refresh token의 disposal flight만 기존 Promise를 공유한다', async () => {
    const harness = createAuthHarness()
    const session = new CredentialSession(harness.http.value, harness.store)
    const firstLogout = deferred<void>()
    const secondLogout = deferred<void>()
    harness.http.logout
      .mockReturnValueOnce(firstLogout.promise)
      .mockReturnValueOnce(secondLogout.promise)

    const firstFlight = session.dispose(REFRESH_1)
    const joinedFlight = session.dispose(REFRESH_1)
    expect(joinedFlight).toBe(firstFlight)
    expect(harness.http.logout).toHaveBeenCalledTimes(1)

    const nextFlight = session.dispose(REFRESH_2)
    expect(nextFlight).not.toBe(firstFlight)
    expect(harness.http.logout).toHaveBeenCalledTimes(2)
    expect(harness.http.logout.mock.calls.map(([refreshToken]) => refreshToken)).toEqual([
      REFRESH_1,
      REFRESH_2
    ])

    firstLogout.resolve()
    secondLogout.resolve()
    await Promise.all([firstFlight, nextFlight])
  })

  it('local marker 확립 실패는 서버 폐기와 구분하며 디스크 credential 삭제를 확정하지 않는다', async () => {
    const harness = createAuthHarness()
    harness.store.inspection = { status: 'ready', refreshToken: REFRESH_0 }
    harness.store.establishOutcomes.push('failed')
    const session = new CredentialSession(harness.http.value, harness.store)
    session.retainForRestore(REFRESH_0)

    const reservation = session.beginLogout()
    await expect(session.finishLogout(reservation)).resolves.toEqual({
      localConfirmed: false,
      serverConfirmed: true
    })

    expect(harness.http.logout).toHaveBeenCalledExactlyOnceWith(REFRESH_0, expect.any(AbortSignal))
    expect(harness.store.clearCredential).not.toHaveBeenCalled()
    expect(harness.store.removeTransition).not.toHaveBeenCalled()
    expect(harness.store.inspection).toEqual({ status: 'ready', refreshToken: REFRESH_0 })
    expect(session.current).toBeNull()
    expect(session.knownRefresh).toBeNull()
  })

  it('서버 폐기 실패를 공유한 caller는 같은 실패를 받고 같은 token을 자동 재전송하지 않는다', async () => {
    const harness = createAuthHarness()
    const session = new CredentialSession(harness.http.value, harness.store)
    const logout = deferred<void>()
    harness.http.logout.mockReturnValueOnce(logout.promise)

    const first = session.dispose(REFRESH_1)
    const second = session.dispose(REFRESH_1)
    logout.reject(new Error('Synthetic logout response loss'))

    await expect(Promise.all([first, second])).resolves.toEqual([false, false])
    await expect(session.dispose(REFRESH_1)).resolves.toBe(false)
    expect(harness.http.logout).toHaveBeenCalledExactlyOnceWith(REFRESH_1, expect.any(AbortSignal))
  })
})

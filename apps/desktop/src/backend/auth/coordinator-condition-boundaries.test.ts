import { describe, expect, it, vi } from 'vitest'
import { createAuthCoordinator } from './coordinator'
import { AuthHttpFailure } from './http'
import {
  ACCESS_2,
  REFRESH_0,
  REFRESH_1,
  REFRESH_2,
  createAuthHarness,
  deferred,
  tokenResponse
} from './auth-test-fixtures'

describe('동시 authorization의 refresh 실패와 credential 복구', () => {
  it('전송 전 실패는 동시 caller를 종료하고 확정 credential로 사용자 재시도를 허용한다', async () => {
    const harness = createAuthHarness()
    harness.store.inspection = { status: 'ready', refreshToken: REFRESH_0 }
    const coordinator = createAuthCoordinator(harness.dependencies)
    await coordinator.start()
    harness.clock.elapseWithoutTimers(16 * 60_000)
    const refresh = deferred<ReturnType<typeof tokenResponse>>()
    harness.http.refresh.mockReturnValueOnce(refresh.promise)

    const first = coordinator.authorization()
    const second = coordinator.authorization()
    await vi.waitFor(() => expect(harness.http.refresh).toHaveBeenCalledTimes(2))
    expect(harness.store.transitionMarker).toBe('refresh')
    refresh.reject(new AuthHttpFailure('network', 'not-sent'))

    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: 'unavailable' },
      { status: 'unavailable' }
    ])
    expect(coordinator.getSnapshot()).toMatchObject({
      phase: 'restorePaused',
      notice: 'NETWORK_UNAVAILABLE',
      user: null,
      entry: null
    })
    expect(harness.store.inspection).toEqual({ status: 'ready', refreshToken: REFRESH_1 })
    expect(harness.store.commitCredential).toHaveBeenCalledTimes(1)
    expect(harness.store.clearCredential).not.toHaveBeenCalled()
    expect(harness.http.logout).not.toHaveBeenCalled()
    await expect(coordinator.authorization()).resolves.toEqual({ status: 'unavailable' })
    expect(harness.http.refresh).toHaveBeenCalledTimes(2)

    harness.http.refresh.mockResolvedValueOnce(
      tokenResponse({
        refreshToken: REFRESH_2,
        accessToken: ACCESS_2,
        accessTokenExpiresAt: '2026-09-06T12:31:00.000Z'
      })
    )
    await expect(coordinator.retryAuth()).resolves.toMatchObject({
      ok: true,
      snapshot: { phase: 'signedIn', entry: 'home' }
    })
    expect(harness.http.refresh).toHaveBeenCalledTimes(3)
    expect(harness.http.refresh.mock.calls.map(([refreshToken]) => refreshToken)).toEqual([
      REFRESH_0,
      REFRESH_1,
      REFRESH_1
    ])
    expect(harness.http.me).toHaveBeenLastCalledWith(ACCESS_2, expect.any(AbortSignal))
    expect(harness.store.inspection).toEqual({ status: 'ready', refreshToken: REFRESH_2 })
  })

  it.each([
    ['응답 유실', 'network'],
    ['인증 상실', 'authentication-required'],
    ['서버 장애', 'unavailable'],
    ['유효하지 않은 응답', 'invalid-response']
  ] as const)(
    '%s는 모든 대기 caller를 차단하고 소비 가능성이 있는 credential을 재사용하지 않는다',
    async (_caseName, code) => {
      const harness = createAuthHarness()
      harness.store.inspection = { status: 'ready', refreshToken: REFRESH_0 }
      const coordinator = createAuthCoordinator(harness.dependencies)
      await coordinator.start()
      harness.clock.elapseWithoutTimers(16 * 60_000)
      const refresh = deferred<ReturnType<typeof tokenResponse>>()
      const clear = deferred<'confirmed'>()
      harness.http.refresh.mockReturnValueOnce(refresh.promise)
      harness.store.clearWaits.push(clear.promise)

      const first = coordinator.authorization()
      const second = coordinator.authorization()
      await vi.waitFor(() => expect(harness.http.refresh).toHaveBeenCalledTimes(2))
      refresh.reject(new AuthHttpFailure(code, 'unknown'))
      await vi.waitFor(() => expect(harness.store.clearCredential).toHaveBeenCalledTimes(1))

      expect(coordinator.getSnapshot()).toMatchObject({ phase: 'signingOut', user: null })
      expect(harness.store.inspection).toEqual({ status: 'recovery-required' })
      await expect(coordinator.authorization()).resolves.toEqual({ status: 'unavailable' })
      await expect(coordinator.beginLogin('passkey')).resolves.toMatchObject({
        ok: false,
        error: { code: 'AUTH_BUSY' }
      })
      expect(harness.http.refresh).toHaveBeenCalledTimes(2)
      expect(harness.store.commitCredential).toHaveBeenCalledTimes(1)
      expect(harness.http.logout).toHaveBeenCalledExactlyOnceWith(
        REFRESH_1,
        expect.any(AbortSignal)
      )

      clear.resolve('confirmed')
      await expect(Promise.all([first, second])).resolves.toEqual([
        { status: 'unavailable' },
        { status: 'unavailable' }
      ])
      expect(coordinator.getSnapshot()).toMatchObject({
        phase: 'signedOut',
        notice: 'REAUTH_REQUIRED',
        user: null,
        entry: null
      })
      expect(harness.store.inspection).toEqual({ status: 'empty' })
      await expect(coordinator.retryAuth()).resolves.toMatchObject({
        ok: false,
        error: { code: 'AUTH_NOT_ALLOWED' }
      })
      expect(harness.http.refresh.mock.calls.map(([refreshToken]) => refreshToken)).toEqual([
        REFRESH_0,
        REFRESH_1
      ])
    }
  )
})

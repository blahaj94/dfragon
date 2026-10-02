import { describe, expect, it, vi } from 'vitest'
import { createAuthCoordinator } from './coordinator'
import { AuthHttpFailure } from './http'
import {
  ACCESS_2,
  CODE,
  REFRESH_0,
  REFRESH_1,
  REFRESH_2,
  RETURN_TARGET,
  USER_ID,
  createAuthHarness,
  deferred,
  tokenResponse
} from './auth-test-fixtures'
import type { MeResponse } from './types'

describe('복원 사용자 조회의 늦은 완료와 새 로그인 수명', () => {
  it.each([
    { stage: '초기 복원', retry: false, result: '성공 응답' },
    { stage: '초기 복원', retry: false, result: '인증 상실 응답' },
    { stage: '사용자 재시도', retry: true, result: '성공 응답' },
    { stage: '사용자 재시도', retry: true, result: '인증 상실 응답' }
  ])(
    '$stage의 늦은 $result는 logout 뒤 새 계정과 credential을 변경하지 않는다',
    async ({ retry, result }) => {
      const harness = createAuthHarness()
      harness.store.inspection = { status: 'ready', refreshToken: REFRESH_0 }
      const previousMe = deferred<MeResponse>()
      const coordinator = createAuthCoordinator(harness.dependencies)
      if (retry) {
        harness.http.me.mockRejectedValueOnce(new AuthHttpFailure('network'))
        await coordinator.start()
        expect(coordinator.getSnapshot().phase).toBe('restorePaused')
      }
      harness.http.me.mockReturnValueOnce(previousMe.promise)

      const restoring = retry ? coordinator.retryAuth() : coordinator.start()
      const expectedMeCalls = retry ? 2 : 1
      await vi.waitFor(() => expect(harness.http.me).toHaveBeenCalledTimes(expectedMeCalls))
      const previousSignal = harness.http.me.mock.calls.at(-1)![1]
      expect(harness.store.inspection).toEqual({ status: 'ready', refreshToken: REFRESH_1 })

      await expect(coordinator.logout()).resolves.toMatchObject({
        ok: true,
        snapshot: { phase: 'signedOut', notice: null, user: null }
      })
      expect(previousSignal.aborted).toBe(true)
      expect(harness.store.inspection).toEqual({ status: 'empty' })
      harness.http.exchange.mockResolvedValueOnce({
        ...tokenResponse({ refreshToken: REFRESH_2, accessToken: ACCESS_2 }),
        user: { id: '20000000-0000-4000-8000-000000000002', nickname: '새모험가' },
        isNewUser: false
      })
      await coordinator.beginLogin('passkey')
      await vi.waitFor(() => expect(coordinator.getSnapshot().phase).toBe('waitingBrowser'))
      await coordinator.handleReturnUrl(`${RETURN_TARGET}?code=${CODE}`)
      const current = coordinator.getSnapshot()
      expect(current).toMatchObject({
        phase: 'signedIn',
        user: { nickname: '새모험가' },
        entry: 'home'
      })

      // 요청 취소 직전에 완료된 transport 결과도 이전 generation에서 발행할 수 없다.
      if (result === '성공 응답') {
        previousMe.resolve({ user: { id: USER_ID, nickname: '이전모험가' } })
      } else {
        previousMe.reject(new AuthHttpFailure('authentication-required'))
      }
      await restoring

      expect(coordinator.getSnapshot()).toEqual(current)
      await expect(coordinator.authorization()).resolves.toMatchObject({
        status: 'available',
        accessToken: ACCESS_2
      })
      expect(harness.store.inspection).toEqual({ status: 'ready', refreshToken: REFRESH_2 })
      expect(harness.http.logout).toHaveBeenCalledExactlyOnceWith(
        REFRESH_1,
        expect.any(AbortSignal)
      )
      expect(harness.http.refresh).toHaveBeenCalledExactlyOnceWith(
        REFRESH_0,
        expect.any(AbortSignal)
      )
      expect(harness.http.me).toHaveBeenCalledTimes(expectedMeCalls)
      expect(harness.store.clearCredential).toHaveBeenCalledTimes(1)
      expect(harness.store.commitCredential.mock.calls).toEqual([[REFRESH_1], [REFRESH_2]])
    }
  )
})

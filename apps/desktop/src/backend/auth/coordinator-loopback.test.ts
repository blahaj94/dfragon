import { describe, expect, it, vi } from 'vitest'
import { createAuthCoordinator } from './coordinator'
import { AuthHttpFailure } from './http'
import {
  API_ORIGIN,
  ATTEMPT_ID,
  CODE,
  REQUEST_ID,
  RETURN_TARGET,
  createAuthHarness,
  deferred
} from './auth-test-fixtures'
import type { LoginReturnListener } from './types'

describe('Desktop 로그인 수신기 수명', () => {
  it('저장 준비 뒤 수신기를 열고 그 주소로 요청을 만든 다음 브라우저를 한 번 연다', async () => {
    const harness = createAuthHarness()
    const opening = deferred<LoginReturnListener>()
    harness.loopback.open.mockImplementationOnce(() => opening.promise)
    const coordinator = createAuthCoordinator(harness.dependencies)
    await coordinator.start()
    await coordinator.beginLogin('passkey')
    await vi.waitFor(() => expect(harness.loopback.open).toHaveBeenCalledOnce())
    expect(harness.http.createLoginRequest).not.toHaveBeenCalled()
    expect(harness.browser.open).not.toHaveBeenCalled()
    expect(coordinator.getSnapshot().phase).toBe('startingLogin')
    opening.resolve(harness.listener)
    await vi.waitFor(() => expect(harness.browser.open).toHaveBeenCalledOnce())
    expect(harness.http.createLoginRequest.mock.calls[0]![0].returnUrl).toBe(RETURN_TARGET)
    expect(harness.listener.close).not.toHaveBeenCalled()

    const exchange = deferred<Awaited<ReturnType<typeof harness.http.exchange>>>()
    harness.http.exchange.mockImplementationOnce(() => {
      expect(harness.listener.close).toHaveBeenCalledOnce()

      return exchange.promise
    })
    const returning = harness.loopback.open.mock.calls[0]![1](`${RETURN_TARGET}?code=${CODE}`)
    await vi.waitFor(() => expect(harness.http.exchange).toHaveBeenCalledOnce())
    expect(harness.activateMainWindow).toHaveBeenCalledOnce()
    expect(coordinator.getSnapshot().phase).toBe('exchanging')
    exchange.reject(new AuthHttpFailure('exchange-invalid'))
    await returning
    expect(coordinator.getSnapshot()).toMatchObject({
      phase: 'signedOut',
      notice: 'LOGIN_RETURN_INVALID',
      login: null
    })
    expect(harness.listener.close).toHaveBeenCalledOnce()
  })

  it('저장 준비 실패는 수신기와 서버, 브라우저를 시작하지 않는다', async () => {
    const harness = createAuthHarness()
    const coordinator = createAuthCoordinator(harness.dependencies)
    await coordinator.start()
    harness.store.inspection = { status: 'unavailable' }
    await coordinator.beginLogin('passkey')
    await vi.waitFor(() => expect(coordinator.getSnapshot().phase).toBe('storageBlocked'))
    expect(harness.loopback.open).not.toHaveBeenCalled()
    expect(harness.http.createLoginRequest).not.toHaveBeenCalled()
    expect(harness.browser.open).not.toHaveBeenCalled()
  })

  it('수신기를 열지 못하면 서버 요청 없이 재시작 안내로 끝낸다', async () => {
    const harness = createAuthHarness()
    harness.loopback.open.mockRejectedValueOnce(new Error('synthetic bind failure'))
    const coordinator = createAuthCoordinator(harness.dependencies)
    await coordinator.start()
    await coordinator.beginLogin('passkey')
    await vi.waitFor(() =>
      expect(coordinator.getSnapshot()).toMatchObject({
        phase: 'signedOut',
        notice: 'LOGIN_RESTART_REQUIRED',
        login: null
      })
    )
    expect(harness.loopback.open.mock.calls[0]![0].aborted).toBe(true)
    expect(harness.http.createLoginRequest).not.toHaveBeenCalled()
    expect(harness.browser.open).not.toHaveBeenCalled()
  })

  it.each(['cancel', 'expiry'] as const)(
    '수신기를 여는 중 %s하면 늦게 열린 수신기도 닫는다',
    async (reason) => {
      const harness = createAuthHarness()
      const opening = deferred<LoginReturnListener>()
      harness.loopback.open.mockImplementationOnce(() => opening.promise)
      const coordinator = createAuthCoordinator(harness.dependencies)
      await coordinator.start()
      await coordinator.beginLogin('passkey')
      await vi.waitFor(() => expect(harness.loopback.open).toHaveBeenCalledOnce())
      if (reason === 'cancel') {
        await coordinator.cancelLogin(ATTEMPT_ID)
      } else {
        harness.clock.advance(600_000)
      }
      expect(harness.loopback.open.mock.calls[0]![0].aborted).toBe(true)
      opening.resolve(harness.listener)
      await vi.waitFor(() => expect(harness.listener.close).toHaveBeenCalledOnce())
      expect(coordinator.getSnapshot()).toMatchObject({
        phase: 'signedOut',
        login: null,
        notice: reason === 'cancel' ? 'LOGIN_CANCELLED' : 'LOGIN_EXPIRED'
      })
      expect(harness.http.createLoginRequest).not.toHaveBeenCalled()
      expect(harness.browser.open).not.toHaveBeenCalled()
    }
  )

  it.each([
    ['network', 'NETWORK_UNAVAILABLE'],
    ['unavailable', 'AUTH_SERVICE_UNAVAILABLE'],
    ['invalid-response', 'LOGIN_RESTART_REQUIRED']
  ] as const)('생성 요청의 %s 실패는 수신기를 닫고 %s로 끝낸다', async (failure, notice) => {
    const harness = createAuthHarness()
    harness.http.createLoginRequest.mockRejectedValueOnce(new AuthHttpFailure(failure))
    const coordinator = createAuthCoordinator(harness.dependencies)
    await coordinator.start()
    await coordinator.beginLogin('passkey')
    await vi.waitFor(() =>
      expect(coordinator.getSnapshot()).toMatchObject({ phase: 'signedOut', notice, login: null })
    )
    expect(harness.listener.close).toHaveBeenCalledOnce()
    expect(harness.browser.open).not.toHaveBeenCalled()
    expect(harness.http.createLoginRequest).toHaveBeenCalledOnce()
  })

  it.each(['cancel', 'expiry', 'browser-failure'] as const)(
    '브라우저 대기 중 %s이면 수신기를 닫고 늦은 callback을 버린다',
    async (reason) => {
      const harness = createAuthHarness()
      const opening = deferred<void>()
      harness.browser.open.mockImplementationOnce(() => opening.promise)
      const coordinator = createAuthCoordinator(harness.dependencies)
      await coordinator.start()
      await coordinator.beginLogin('passkey')
      await vi.waitFor(() => expect(harness.browser.open).toHaveBeenCalledOnce())
      if (reason === 'cancel') {
        await coordinator.cancelLogin(ATTEMPT_ID)
      } else if (reason === 'expiry') {
        harness.clock.advance(600_000)
      }
      opening.reject(new Error('synthetic open failure'))
      await vi.waitFor(() => expect(harness.listener.close).toHaveBeenCalledOnce())
      const notices = {
        cancel: 'LOGIN_CANCELLED',
        expiry: 'LOGIN_EXPIRED',
        'browser-failure': 'BROWSER_OPEN_FAILED'
      }
      const stopped = coordinator.getSnapshot()
      expect(stopped).toMatchObject({
        phase: 'signedOut',
        notice: notices[reason],
        login: null
      })
      await harness.loopback.open.mock.calls[0]![1](`${RETURN_TARGET}?code=${CODE}`)
      expect(coordinator.getSnapshot()).toEqual(stopped)
      expect(harness.http.exchange).not.toHaveBeenCalled()
      expect(harness.activateMainWindow).not.toHaveBeenCalled()
      expect(harness.loopback.open).toHaveBeenCalledOnce()
    }
  )

  it.each([
    ['다른 origin', `https://other.example.test/auth/login/authorize?ticket=${CODE}`],
    ['다른 path', `${API_ORIGIN}/other?ticket=${CODE}`],
    ['javascript scheme', 'javascript:alert(1)']
  ])(
    'HTTP mock의 %s browserUrl은 브라우저를 열지 않고 수신기를 닫는다',
    async (_scenario, browserUrl) => {
      const harness = createAuthHarness()
      // HTTP 응답 parser를 거치지 않아 coordinator의 launch URL 검사를 직접 확인한다.
      harness.http.createLoginRequest.mockResolvedValueOnce({
        requestId: REQUEST_ID,
        browserUrl,
        expiresAt: '2026-09-06T12:10:00.000Z'
      })
      const coordinator = createAuthCoordinator(harness.dependencies)
      await coordinator.start()
      await coordinator.beginLogin('passkey')
      await vi.waitFor(() =>
        expect(coordinator.getSnapshot()).toMatchObject({
          phase: 'signedOut',
          notice: 'LOGIN_RESTART_REQUIRED',
          login: null
        })
      )
      expect(harness.listener.close).toHaveBeenCalledOnce()
      expect(harness.browser.open).not.toHaveBeenCalled()
      expect(harness.http.exchange).not.toHaveBeenCalled()
    }
  )

  it('이전 수신기의 늦은 callback은 새 pending을 claim하지 못한다', async () => {
    const harness = createAuthHarness()
    const coordinator = createAuthCoordinator(harness.dependencies)
    await coordinator.start()
    await coordinator.beginLogin('passkey')
    await vi.waitFor(() => expect(harness.browser.open).toHaveBeenCalledOnce())
    const previousReturn = harness.loopback.open.mock.calls[0]![1]
    await coordinator.cancelLogin(ATTEMPT_ID)
    await coordinator.beginLogin('passkey')
    await vi.waitFor(() => expect(harness.browser.open).toHaveBeenCalledTimes(2))
    await previousReturn(`${RETURN_TARGET}?code=${CODE}`)
    await coordinator.handleReturnUrl(`dfragon://auth/callback?code=${CODE}`)
    await coordinator.handleReturnUrl(`http://127.0.0.1:49153/auth/callback?code=${CODE}`)
    expect(harness.http.exchange).not.toHaveBeenCalled()
    expect(coordinator.getSnapshot().phase).toBe('waitingBrowser')
    await harness.loopback.open.mock.calls[1]![1](`${RETURN_TARGET}?code=${CODE}`)
    expect(harness.http.exchange).toHaveBeenCalledOnce()
    expect(coordinator.getSnapshot().phase).toBe('signedIn')
  })

  it('callback이 먼저 교환을 시작하면 늦은 브라우저 열기 실패가 이를 취소하지 않는다', async () => {
    const harness = createAuthHarness()
    const opening = deferred<void>()
    const exchange = deferred<Awaited<ReturnType<typeof harness.http.exchange>>>()
    harness.browser.open.mockImplementationOnce(() => opening.promise)
    harness.http.exchange.mockImplementationOnce(() => exchange.promise)
    const coordinator = createAuthCoordinator(harness.dependencies)
    await coordinator.start()
    await coordinator.beginLogin('passkey')
    await vi.waitFor(() => expect(harness.browser.open).toHaveBeenCalledOnce())
    const returning = harness.loopback.open.mock.calls[0]![1](`${RETURN_TARGET}?code=${CODE}`)
    await vi.waitFor(() => expect(harness.http.exchange).toHaveBeenCalledOnce())
    opening.reject(new Error('late browser failure'))
    await Promise.resolve()
    expect(coordinator.getSnapshot().phase).toBe('exchanging')
    exchange.reject(new AuthHttpFailure('exchange-invalid'))
    await returning
    expect(coordinator.getSnapshot()).toMatchObject({
      phase: 'signedOut',
      notice: 'LOGIN_RETURN_INVALID'
    })
  })
})

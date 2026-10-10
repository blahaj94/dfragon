import { describe, expect, it, vi } from 'vitest'
import { createAuthRuntimeEffects } from './runtime-effects'
import { API_ORIGIN, CODE, createAuthHarness, deferred } from './auth-test-fixtures'
import { bootstrapAuthRuntime } from './bootstrap'
import type { AuthRuntimeConfig } from './runtime-config'
import { shell } from 'electron'
import { createAuthCoordinator } from './coordinator'

vi.mock('electron', () => {
  const shell = {
    openExternal: vi.fn<typeof import('electron').shell.openExternal>(async () => {})
  }

  return { safeStorage: {}, shell }
})

const config: AuthRuntimeConfig = {
  apiOrigin: 'https://api.synthetic.test',
  returnTarget: 'dfragon-synthetic://auth/return',
  environment: 'test',
  providers: ['passkey'],
  appIdentity: 'com.synthetic.dfragon',
  userDataPath: '/synthetic/user-data'
}

describe('desktop auth runtime effects', () => {
  it.each(['success', 'failure'] as const)(
    '시스템 브라우저 %s와 실제 loopback 수신기를 coordinator에 연결한다',
    async (outcome) => {
      const harness = createAuthHarness()
      const activateMainWindow = vi.fn()
      vi.mocked(shell.openExternal).mockReset().mockResolvedValue(undefined)
      if (outcome === 'failure') {
        vi.mocked(shell.openExternal).mockRejectedValueOnce(new Error('synthetic browser failure'))
      }
      const effects = createAuthRuntimeEffects({
        safeStorage: {
          isEncryptionAvailable: () => true,
          encryptString: (value) => Buffer.from(value),
          decryptString: (value) => value.toString()
        },
        createHttp: () => harness.dependencies.http,
        createStore: () => harness.store,
        activateMainWindow
      })
      const dependencies = effects.createDependencies({ ...config, apiOrigin: API_ORIGIN })
      const coordinator = createAuthCoordinator({ ...dependencies, clock: harness.clock })
      await coordinator.start()
      await coordinator.beginLogin('passkey')
      await vi.waitFor(() => expect(shell.openExternal).toHaveBeenCalledOnce())
      const request = harness.http.createLoginRequest.mock.calls[0]![0]
      expect(request.returnUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/auth\/callback$/)
      const ticket = Buffer.alloc(32, 8).toString('base64url')
      expect(shell.openExternal).toHaveBeenCalledWith(
        `${API_ORIGIN}/auth/login/authorize?ticket=${ticket}`
      )
      if (outcome === 'failure') {
        expect(coordinator.getSnapshot()).toMatchObject({
          phase: 'signedOut',
          notice: 'BROWSER_OPEN_FAILED'
        })
        await expect(fetch(`${request.returnUrl}?code=${CODE}`)).rejects.toThrow()
        expect(activateMainWindow).not.toHaveBeenCalled()
        expect(harness.http.exchange).not.toHaveBeenCalled()

        return
      }
      try {
        const response = await fetch(`${request.returnUrl}?code=${CODE}`)
        expect(response.status).toBe(200)
        await response.text()
        await vi.waitFor(() => expect(coordinator.getSnapshot().phase).toBe('signedIn'))
        expect(activateMainWindow).toHaveBeenCalledOnce()
        expect(harness.http.exchange).toHaveBeenCalledOnce()
        await coordinator.managePasskeys()
        expect(shell.openExternal).toHaveBeenLastCalledWith(`${API_ORIGIN}/auth/passkeys/manage`)
        expect(shell.openExternal).toHaveBeenCalledTimes(2)
      } finally {
        const attemptId = coordinator.getSnapshot().login?.attemptId
        if (attemptId != null) {
          await coordinator.cancelLogin(attemptId)
        }
      }
    }
  )

  it('binds HTTP, browser and store to the same trusted runtime tuple', async () => {
    const harness = createAuthHarness()
    const fetch = vi.fn()
    const openBrowser = vi.fn(async () => undefined)
    const http = vi.fn(() => harness.dependencies.http)
    const store = vi.fn(() => harness.store)
    const effects = createAuthRuntimeEffects({
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(value),
        decryptString: (value) => value.toString()
      },
      platform: 'darwin',
      fetch,
      openBrowser,
      createHttp: http,
      createStore: store
    })

    const dependencies = effects.createDependencies(config)

    expect(http).toHaveBeenCalledWith({ apiOrigin: config.apiOrigin, fetch })
    expect(store).toHaveBeenCalledWith(
      expect.objectContaining({
        userDataPath: config.userDataPath,
        context: {
          environment: config.environment,
          apiOrigin: config.apiOrigin,
          clientId: 'desktop'
        },
        platform: 'darwin'
      })
    )
    expect(dependencies.apiOrigin).toBe(config.apiOrigin)
    expect(dependencies).not.toHaveProperty('returnTarget')
    expect(dependencies.providers).toEqual(config.providers)
    const browserUrl = 'https://api.synthetic.test/auth/login/authorize?ticket=synthetic'
    await dependencies.browser.open(browserUrl)
    expect(openBrowser).toHaveBeenCalledExactlyOnceWith(browserUrl)
  })

  it('provides distinct production-size CSPRNG bytes and canonical UUIDs to the coordinator', () => {
    const harness = createAuthHarness()
    const effects = createAuthRuntimeEffects({
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(value),
        decryptString: (value) => value.toString()
      },
      platform: 'darwin',
      createHttp: () => harness.dependencies.http,
      createStore: () => harness.store
    })
    const entropy = effects.createDependencies(config).entropy
    const firstBytes = entropy.bytes(32)
    const secondBytes = entropy.bytes(32)
    const firstUuid = entropy.uuid()
    const secondUuid = entropy.uuid()

    expect(firstBytes).toHaveLength(32)
    expect(secondBytes).toHaveLength(32)
    expect(firstBytes).not.toEqual(secondBytes)
    expect(firstUuid).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/)
    expect(secondUuid).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/)
    expect(firstUuid).not.toBe(secondUuid)
  })

  it('keeps the default non-macOS credential adapter blocked without native side effects', async () => {
    const fetch = vi.fn()
    const openBrowser = vi.fn(async () => undefined)
    const safeStorage = {
      isEncryptionAvailable: vi.fn(() => {
        throw new Error('Synthetic safeStorage access')
      }),
      encryptString: vi.fn(() => {
        throw new Error('Synthetic safeStorage access')
      }),
      decryptString: vi.fn(() => {
        throw new Error('Synthetic safeStorage access')
      })
    }
    const effects = createAuthRuntimeEffects({
      safeStorage,
      platform: 'linux',
      fetch,
      openBrowser
    })
    const runtime = await bootstrapAuthRuntime({ config, effects })
    if (runtime == null) {
      throw new Error('Synthetic auth runtime should be available')
    }

    await runtime.start()

    expect(runtime.coordinator.getSnapshot()).toMatchObject({
      phase: 'storageBlocked',
      notice: 'SECURE_STORAGE_UNAVAILABLE'
    })
    expect(safeStorage.isEncryptionAvailable).not.toHaveBeenCalled()
    expect(safeStorage.encryptString).not.toHaveBeenCalled()
    expect(safeStorage.decryptString).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(openBrowser).not.toHaveBeenCalled()
  })

  it('selects the Windows adapter and keeps the native gate closed until verified', async () => {
    const fetch = vi.fn()
    const safeStorage = {
      isEncryptionAvailable: vi.fn(() => {
        throw new Error('Synthetic safeStorage access')
      }),
      encryptString: vi.fn(() => {
        throw new Error('Synthetic safeStorage access')
      }),
      decryptString: vi.fn(() => {
        throw new Error('Synthetic safeStorage access')
      })
    }
    const effects = createAuthRuntimeEffects({
      safeStorage,
      platform: 'win32',
      fetch,
      openBrowser: vi.fn(async () => undefined)
    })
    const runtime = await bootstrapAuthRuntime({ config, effects })
    if (runtime == null) {
      throw new Error('Synthetic auth runtime should be available')
    }

    await runtime.start()

    expect(runtime.coordinator.getSnapshot()).toMatchObject({
      phase: 'storageBlocked',
      notice: 'SECURE_STORAGE_UNAVAILABLE'
    })
    expect(safeStorage.isEncryptionAvailable).not.toHaveBeenCalled()
    expect(safeStorage.encryptString).not.toHaveBeenCalled()
    expect(safeStorage.decryptString).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps auth rollback detection isolated from search clock reads', () => {
    let wallMs = 1_000
    let monotonicMs = 50
    const harness = createAuthHarness()
    const effects = createAuthRuntimeEffects({
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(value),
        decryptString: (value) => value.toString()
      },
      platform: 'darwin',
      readWallMs: () => wallMs,
      readMonotonicMs: () => monotonicMs,
      createHttp: () => harness.dependencies.http,
      createStore: () => harness.store
    })
    const authClock = effects.createDependencies(config).clock
    const searchClock = effects.createSearchClock()

    expect(authClock.read()).toEqual({ wallMs: 1_000, monotonicMs: 50, discontinuous: false })
    expect(searchClock.read()).toEqual({ wallMs: 1_000, monotonicMs: 50, discontinuous: false })
    wallMs = 900
    monotonicMs = 60

    expect(searchClock.read()).toEqual({ wallMs: 900, monotonicMs: 60, discontinuous: true })
    expect(authClock.read()).toEqual({ wallMs: 900, monotonicMs: 60, discontinuous: true })
  })

  it('marks a monotonic-only reversal as discontinuous while wall time still advances', () => {
    let wallMs = 1_000
    let monotonicMs = 50
    const harness = createAuthHarness()
    const effects = createAuthRuntimeEffects({
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(value),
        decryptString: (value) => value.toString()
      },
      platform: 'darwin',
      readWallMs: () => wallMs,
      readMonotonicMs: () => monotonicMs,
      createHttp: () => harness.dependencies.http,
      createStore: () => harness.store
    })
    const authClock = effects.createDependencies(config).clock

    expect(authClock.read()).toEqual({ wallMs: 1_000, monotonicMs: 50, discontinuous: false })
    wallMs = 1_100
    monotonicMs = 40

    expect(authClock.read()).toEqual({ wallMs: 1_100, monotonicMs: 40, discontinuous: true })
  })

  it('schedules runtime clock callbacks at the requested delay and cancels them', async () => {
    vi.useFakeTimers()
    try {
      const harness = createAuthHarness()
      const effects = createAuthRuntimeEffects({
        safeStorage: {
          isEncryptionAvailable: () => true,
          encryptString: (value) => Buffer.from(value),
          decryptString: (value) => value.toString()
        },
        platform: 'darwin',
        createHttp: () => harness.dependencies.http,
        createStore: () => harness.store
      })
      const clock = effects.createDependencies(config).clock
      const first = vi.fn()
      const second = vi.fn()

      clock.schedule(100, first)
      const cancelSecond = clock.schedule(100, second)
      cancelSecond()
      await vi.advanceTimersByTimeAsync(99)
      expect(first).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(first).toHaveBeenCalledOnce()
      expect(second).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('passes a wall-clock reversal during restore to the coordinator pause guard', async () => {
    const harness = createAuthHarness()
    harness.store.inspection = { status: 'ready', refreshToken: 'synthetic-refresh-token' }
    const me = deferred<Awaited<ReturnType<typeof harness.dependencies.http.me>>>()
    harness.http.me.mockImplementation(async () => me.promise)
    let wallMs = Date.parse('2026-09-06T12:00:00.000Z')
    let monotonicMs = 1_000
    const effects = createAuthRuntimeEffects({
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(value),
        decryptString: (value) => value.toString()
      },
      platform: 'darwin',
      readWallMs: () => wallMs,
      readMonotonicMs: () => monotonicMs,
      createHttp: () => harness.dependencies.http,
      createStore: () => harness.store
    })
    const runtime = await bootstrapAuthRuntime({
      config,
      effects: {
        createDependencies: effects.createDependencies,
        createSearchClock: effects.createSearchClock
      }
    })
    if (runtime == null) {
      throw new Error('Synthetic auth runtime should be available')
    }

    const start = runtime.start()
    await vi.waitFor(() => expect(harness.http.me).toHaveBeenCalledOnce())
    wallMs -= 1_000
    monotonicMs -= 1_000
    me.resolve({ user: { id: '20000000-0000-4000-8000-000000000001', nickname: '모험가000001' } })
    await start

    expect(runtime.coordinator.getSnapshot()).toMatchObject({
      phase: 'restorePaused',
      notice: 'RESTORE_RETRY_REQUIRED'
    })
  })

  it('uses the dependency creation clock reading as the restore discontinuity baseline', async () => {
    const harness = createAuthHarness()
    harness.store.inspection = { status: 'ready', refreshToken: 'synthetic-refresh-token' }
    const commit =
      deferred<Awaited<ReturnType<typeof harness.dependencies.store.commitCredential>>>()
    harness.store.commitWaits.push(commit.promise)
    let wallMs = Date.parse('2026-09-06T12:00:00.000Z')
    let monotonicMs = 1_000
    const effects = createAuthRuntimeEffects({
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(value),
        decryptString: (value) => value.toString()
      },
      platform: 'darwin',
      readWallMs: () => wallMs,
      readMonotonicMs: () => monotonicMs,
      createHttp: () => harness.dependencies.http,
      createStore: () => harness.store
    })
    const runtime = await bootstrapAuthRuntime({
      config,
      effects: {
        createDependencies: effects.createDependencies,
        createSearchClock: effects.createSearchClock
      }
    })
    if (runtime == null) {
      throw new Error('Synthetic auth runtime should be available')
    }

    const start = runtime.start()
    await vi.waitFor(() => expect(harness.store.commitCredential).toHaveBeenCalledOnce())
    wallMs -= 1_000
    monotonicMs += 100
    commit.resolve('confirmed')
    await start

    expect(runtime.coordinator.getSnapshot()).toMatchObject({
      phase: 'restorePaused',
      notice: 'RESTORE_RETRY_REQUIRED'
    })
    expect(harness.http.me).not.toHaveBeenCalled()
  })
})

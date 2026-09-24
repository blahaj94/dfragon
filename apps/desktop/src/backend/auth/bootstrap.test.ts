import { describe, expect, it, vi } from 'vitest'
import { bootstrapAuthRuntime } from './bootstrap'
import { createAuthHarness, CODE, deferred, REFRESH_0, settle } from './auth-test-fixtures'
import { AuthHttpFailure } from './http'
import type { AuthRuntimeConfig } from './runtime-config'
import type { AuthClock } from './types'

const config: AuthRuntimeConfig = {
  apiOrigin: 'https://api.example.test',
  returnTarget: 'dfragon-test://auth/return',
  environment: 'test',
  providers: ['passkey'],
  appIdentity: 'com.synthetic.dfragon',
  userDataPath: '/synthetic/user-data'
}

describe('desktop auth bootstrap', () => {
  it('uses the trusted bootstrap config as the sole dependency tuple provenance', async () => {
    const harness = createAuthHarness()
    const effectsConfig: AuthRuntimeConfig = {
      ...config,
      apiOrigin: 'https://other-api.example.test'
    }
    const createDependencies = vi.fn((selectedConfig: AuthRuntimeConfig = effectsConfig) => ({
      ...harness.dependencies,
      apiOrigin: selectedConfig.apiOrigin
    }))

    const runtime = await bootstrapAuthRuntime({
      config,
      effects: {
        createDependencies,
        createSearchClock: () => harness.clock
      }
    })

    expect(createDependencies).toHaveBeenCalledExactlyOnceWith(config)
    expect(runtime?.apiOrigin).toBe(config.apiOrigin)
  })

  it('creates the auth runtime without an app-level storage confirmation and defers restore until start', async () => {
    const harness = createAuthHarness()
    const operations = harness.operations
    const createDependencies = vi.fn(() => {
      operations.push('dependencies:create')
      return harness.dependencies
    })
    const searchClock = {
      read: vi.fn(() => ({ wallMs: 1, monotonicMs: 1, discontinuous: false })),
      schedule: vi.fn(() => () => undefined)
    } satisfies AuthClock
    const createSearchClock = vi.fn(() => searchClock)
    const runtime = await bootstrapAuthRuntime({
      config,
      effects: { createDependencies, createSearchClock }
    })

    expect(runtime?.coordinator.getSnapshot().phase).toBe('restoring')
    expect(operations).toEqual(['dependencies:create'])
    expect(createDependencies).toHaveBeenCalledOnce()
    expect(createSearchClock).toHaveBeenCalledOnce()
    expect(runtime?.searchClock).toBe(searchClock)
    expect(runtime?.searchClock).not.toBe(harness.dependencies.clock)

    await runtime?.start()
    expect(operations).toEqual(['dependencies:create', 'store:inspect'])
  })

  it('reaches the fail-closed storage state when startup inspection is unavailable', async () => {
    const harness = createAuthHarness()
    harness.store.inspection = { status: 'unavailable' }
    const runtime = await bootstrapAuthRuntime({
      config,
      effects: {
        createDependencies: () => harness.dependencies,
        createSearchClock: () => harness.clock
      }
    })
    if (runtime == null) {
      throw new Error('Synthetic auth runtime should be available')
    }

    await runtime.start()

    expect(harness.store.inspect).toHaveBeenCalledOnce()
    expect(runtime.coordinator.getSnapshot()).toMatchObject({
      phase: 'storageBlocked',
      notice: 'SECURE_STORAGE_UNAVAILABLE'
    })
    expect(harness.http.refresh).not.toHaveBeenCalled()
    expect(harness.http.me).not.toHaveBeenCalled()
  })

  it('does not create auth effects when trusted configuration is absent', async () => {
    const createDependencies = vi.fn(() => createAuthHarness().dependencies)
    const createSearchClock = vi.fn(() => createAuthHarness().clock)

    const runtime = await bootstrapAuthRuntime({
      config: null,
      effects: { createDependencies, createSearchClock }
    })

    expect(runtime).toBeNull()
    expect(createDependencies).not.toHaveBeenCalled()
    expect(createSearchClock).not.toHaveBeenCalled()
  })

  it('does not create auth effects when the runtime is already inactive', async () => {
    const createDependencies = vi.fn(() => createAuthHarness().dependencies)
    const createSearchClock = vi.fn(() => createAuthHarness().clock)
    const isActive = vi.fn(() => false)

    const runtime = await bootstrapAuthRuntime({
      config,
      effects: { createDependencies, createSearchClock },
      isActive
    })

    expect(runtime).toBeNull()
    expect(isActive).toHaveBeenCalledOnce()
    expect(createDependencies).not.toHaveBeenCalled()
    expect(createSearchClock).not.toHaveBeenCalled()
  })

  it('propagates unexpected dependency construction failures', async () => {
    const dependencyFailure = new Error('synthetic dependency construction failure')
    const createDependencies = vi.fn(() => {
      throw dependencyFailure
    })
    const createSearchClock = vi.fn(() => createAuthHarness().clock)

    const bootstrap = bootstrapAuthRuntime({
      config,
      effects: {
        createDependencies,
        createSearchClock
      }
    })

    await expect(bootstrap).rejects.toBe(dependencyFailure)
    expect(createDependencies).toHaveBeenCalledOnce()
    expect(createSearchClock).not.toHaveBeenCalled()
  })

  it('propagates unexpected search clock construction failures', async () => {
    const harness = createAuthHarness()
    const searchClockFailure = new Error('synthetic search clock construction failure')
    const createSearchClock = vi.fn(() => {
      throw searchClockFailure
    })

    const bootstrap = bootstrapAuthRuntime({
      config,
      effects: {
        createDependencies: vi.fn(() => harness.dependencies),
        createSearchClock
      }
    })

    await expect(bootstrap).rejects.toBe(searchClockFailure)
    expect(createSearchClock).toHaveBeenCalledOnce()
    expect(harness.entropy.uuid).not.toHaveBeenCalled()
  })

  it('propagates unexpected coordinator construction failures', async () => {
    const harness = createAuthHarness()
    const invalidDependencies = { ...harness.dependencies, apiOrigin: 'http://api.example.test' }

    const bootstrap = bootstrapAuthRuntime({
      config,
      effects: {
        createDependencies: vi.fn(() => invalidDependencies),
        createSearchClock: vi.fn(() => harness.clock)
      }
    })

    await expect(bootstrap).rejects.toThrow('Authentication URL is invalid.')
  })

  it('connects a synthetic successful login without using production environment values', async () => {
    const harness = createAuthHarness()
    const runtime = await bootstrapAuthRuntime({
      config,
      effects: {
        createDependencies: () => harness.dependencies,
        createSearchClock: () => harness.clock
      }
    })
    if (runtime == null) {
      throw new Error('Synthetic auth runtime should be available')
    }

    await runtime.start()
    const started = await runtime.coordinator.beginLogin('passkey')
    await settle()
    expect(started).toMatchObject({ ok: true, snapshot: { phase: 'startingLogin' } })
    expect(runtime.coordinator.getSnapshot()).toMatchObject({ phase: 'waitingBrowser' })
    await runtime.coordinator.handleReturnUrl(`${config.returnTarget}?code=${CODE}`)

    expect(runtime.coordinator.getSnapshot()).toMatchObject({
      phase: 'signedIn',
      entry: 'welcome',
      user: { nickname: '모험가000001' },
      notice: null
    })
  })

  it('keeps login failure and restore failure in the existing retry notices', async () => {
    const failedLoginHarness = createAuthHarness()
    failedLoginHarness.http.exchange.mockRejectedValue(new AuthHttpFailure('network'))
    const failedLogin = await bootstrapAuthRuntime({
      config,
      effects: {
        createDependencies: () => failedLoginHarness.dependencies,
        createSearchClock: () => failedLoginHarness.clock
      }
    })
    if (failedLogin == null) {
      throw new Error('Synthetic auth runtime should be available')
    }
    await failedLogin.start()
    await failedLogin.coordinator.beginLogin('passkey')
    await settle()
    await failedLogin.coordinator.handleReturnUrl(`${config.returnTarget}?code=${CODE}`)
    expect(failedLogin.coordinator.getSnapshot()).toMatchObject({
      phase: 'signedOut',
      notice: 'LOGIN_RESTART_REQUIRED'
    })

    const restoreHarness = createAuthHarness()
    restoreHarness.store.inspection = { status: 'ready', refreshToken: REFRESH_0 }
    restoreHarness.http.me.mockRejectedValue(new AuthHttpFailure('network'))
    const restored = await bootstrapAuthRuntime({
      config,
      effects: {
        createDependencies: () => restoreHarness.dependencies,
        createSearchClock: () => restoreHarness.clock
      }
    })
    if (restored == null) {
      throw new Error('Synthetic auth runtime should be available')
    }
    const start = restored.start()
    await start
    expect(restored.coordinator.getSnapshot()).toMatchObject({
      phase: 'restorePaused',
      notice: 'NETWORK_UNAVAILABLE'
    })

    restoreHarness.http.me.mockResolvedValue({
      user: { id: '20000000-0000-4000-8000-000000000001', nickname: '모험가000001' }
    })
    const retry = await restored.coordinator.retryAuth()
    await settle()
    await start
    expect(retry).toMatchObject({ ok: true, snapshot: { phase: 'signedIn' } })
  })

  it('exposes restoring coordinator state before start so logout can be wired immediately', async () => {
    const harness = createAuthHarness()
    harness.store.inspection = { status: 'ready', refreshToken: REFRESH_0 }
    const pendingMe = deferred<Awaited<ReturnType<typeof harness.dependencies.http.me>>>()
    harness.http.me.mockImplementation(async () => pendingMe.promise)
    const runtime = await bootstrapAuthRuntime({
      config,
      effects: {
        createDependencies: () => harness.dependencies,
        createSearchClock: () => harness.clock
      }
    })
    if (runtime == null) {
      throw new Error('Synthetic auth runtime should be available')
    }

    expect(runtime.coordinator.getSnapshot().phase).toBe('restoring')
    const start = runtime.start()
    await vi.waitFor(() => expect(harness.http.me).toHaveBeenCalledOnce())
    const logout = runtime.coordinator.logout()

    expect(runtime.coordinator.getSnapshot().phase).toBe('signingOut')
    pendingMe.resolve({
      user: { id: '20000000-0000-4000-8000-000000000001', nickname: '모험가000001' }
    })
    expect(await logout).toMatchObject({ ok: true, snapshot: { phase: 'signedOut' } })
    expect(runtime.coordinator.getSnapshot()).toMatchObject({ phase: 'signedOut' })
    await start
  })
})

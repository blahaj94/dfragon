import type { BrowserWindow } from 'electron'
import { expect, it, vi } from 'vitest'
import { createAuthAppLifecycle } from './app-lifecycle'

type QuitEvent = { defaultPrevented: boolean }
type App = Parameters<typeof createAuthAppLifecycle>[0]['app'] & {
  exit: ReturnType<typeof vi.fn>
}

function createApp(): {
  app: App
  handlers: Map<string, (...args: never[]) => Promise<void> | void>
} {
  const handlers = new Map<string, (...args: never[]) => Promise<void> | void>()
  const app = {
    on: vi.fn((event: string, handler: (...args: never[]) => Promise<void> | void) => {
      handlers.set(event, handler)
    }),
    exit: vi.fn()
  }

  return { app, handlers }
}

function createWindow(): {
  window: BrowserWindow
  handlers: Map<string, (...args: never[]) => void>
  webContentsHandlers: Map<string, (...args: never[]) => void>
  destroy: ReturnType<typeof vi.fn>
} {
  const handlers = new Map<string, (...args: never[]) => void>()
  const webContentsHandlers = new Map<string, (...args: never[]) => void>()
  const destroy = vi.fn()
  const window = {
    isDestroyed: vi.fn(() => false),
    destroy,
    on: vi.fn((event: string, handler: (...args: never[]) => void) => {
      handlers.set(event, handler)
    }),
    webContents: {
      on: vi.fn((event: string, handler: (...args: never[]) => void) => {
        webContentsHandlers.set(event, handler)
      })
    }
  } as unknown as BrowserWindow

  return { window, handlers, webContentsHandlers, destroy }
}

function createLifecycle(): {
  lifecycle: ReturnType<typeof createAuthAppLifecycle>
  handlers: Map<string, (...args: never[]) => Promise<void> | void>
  disposePowerMonitor: ReturnType<typeof vi.fn>
  app: App
} {
  const { app, handlers } = createApp()
  const disposePowerMonitor = vi.fn()
  const lifecycle = createAuthAppLifecycle({
    app,
    ownsAuthProfile: () => true
  })
  lifecycle.setPowerMonitorDisposer(disposePowerMonitor)
  lifecycle.registerAppHandlers()

  return { lifecycle, handlers, disposePowerMonitor, app }
}

it('canceled quit resolves waiters and resumes deferred actions', async () => {
  const { lifecycle, handlers } = createLifecycle()
  const beforeQuit = handlers.get('before-quit')!
  const willQuit = handlers.get('will-quit')!
  const action = vi.fn()

  beforeQuit({ defaultPrevented: false } as never)
  const pendingAction = lifecycle.runAfterQuitOutcome(action)
  expect(action).not.toHaveBeenCalled()

  willQuit({ defaultPrevented: true } as never)
  await pendingAction

  expect(action).toHaveBeenCalledOnce()
  expect(lifecycle.isQuitting()).toBe(false)
  expect(lifecycle.isShutdownCommitted()).toBe(false)
})

it('committed quit resolves waiters as terminal and releases auth resources once', async () => {
  const { lifecycle, handlers, disposePowerMonitor, app } = createLifecycle()
  const beforeQuit = handlers.get('before-quit')!
  const quit = handlers.get('quit')!
  const action = vi.fn()

  beforeQuit({ defaultPrevented: false } as never)
  const pendingAction = lifecycle.runAfterQuitOutcome(action)
  quit()
  await pendingAction

  expect(action).not.toHaveBeenCalled()
  expect(disposePowerMonitor).toHaveBeenCalledOnce()
  expect(app.exit).not.toHaveBeenCalled()
  expect(lifecycle.isShutdownCommitted()).toBe(true)

  quit()
  expect(disposePowerMonitor).toHaveBeenCalledOnce()
})

it('창 준비 전에 반복한 두 번째 실행 요청은 활성화를 연결하면 정확히 한 번 실행된다', async () => {
  const { lifecycle, handlers } = createLifecycle()
  const activate = vi.fn()
  const nextActivate = vi.fn()
  const secondInstance = handlers.get('second-instance')!

  await secondInstance()
  await secondInstance()
  expect(activate).not.toHaveBeenCalled()
  lifecycle.enableWindowActivation(activate)
  expect(activate).toHaveBeenCalledOnce()

  lifecycle.enableWindowActivation(nextActivate)
  expect(nextActivate).not.toHaveBeenCalled()
  await secondInstance()
  expect(nextActivate).toHaveBeenCalledOnce()
  expect(activate).toHaveBeenCalledOnce()
})

it.each(['cancel', 'commit'] as const)(
  'quit 시도 중 두 번째 실행 요청은 %s 결과를 기다린다',
  async (outcome) => {
    const { lifecycle, handlers } = createLifecycle()
    const activate = vi.fn()
    lifecycle.enableWindowActivation(activate)
    handlers.get('before-quit')!({ defaultPrevented: false } as never)

    const activation = handlers.get('second-instance')!()
    expect(activate).not.toHaveBeenCalled()
    if (outcome === 'cancel') {
      handlers.get('will-quit')!({ defaultPrevented: true } as never)
    } else {
      handlers.get('quit')!()
    }
    await activation

    expect(activate).toHaveBeenCalledTimes(outcome === 'cancel' ? 1 : 0)
  }
)

it('quit 취소 직후 보류한 활성화가 재개되기 전에 종료가 확정되면 실행하지 않는다', async () => {
  const { lifecycle, handlers } = createLifecycle()
  const activate = vi.fn()
  lifecycle.enableWindowActivation(activate)
  handlers.get('before-quit')!({ defaultPrevented: false } as never)
  const committedAfterCancellation = lifecycle.waitForQuitOutcome().then((canResume) => {
    expect(canResume).toBe(true)
    handlers.get('quit')!()
  })
  const activation = handlers.get('second-instance')!()

  handlers.get('will-quit')!({ defaultPrevented: true } as never)
  await Promise.all([committedAfterCancellation, activation])

  expect(activate).not.toHaveBeenCalled()
})

it('확정 종료 뒤 늦게 연결한 활성화와 새 실행 요청은 실행하지 않는다', async () => {
  const { lifecycle, handlers } = createLifecycle()
  const activate = vi.fn()
  const secondInstance = handlers.get('second-instance')!

  await secondInstance()
  handlers.get('quit')!()
  lifecycle.enableWindowActivation(activate)
  await secondInstance()

  expect(activate).not.toHaveBeenCalled()
})

it.each(['cancel', 'commit'] as const)(
  'waits for the second quit outcome after the first quit is canceled (%s)',
  async (outcome) => {
    const { lifecycle, handlers } = createLifecycle()
    const beforeQuit = handlers.get('before-quit')!
    const willQuit = handlers.get('will-quit')!
    const quit = handlers.get('quit')!
    let actionStartedWhileQuitting = false
    const action = vi.fn(() => {
      actionStartedWhileQuitting = lifecycle.isQuitting()
    })

    beforeQuit({ defaultPrevented: false } as never)
    const pendingAction = lifecycle.runAfterQuitOutcome(action)
    willQuit({ defaultPrevented: true } as never)
    await Promise.resolve()

    beforeQuit({ defaultPrevented: false } as never)
    queueMicrotask(() => {
      if (outcome === 'cancel') {
        willQuit({ defaultPrevented: true } as never)

        return
      }
      quit()
    })

    await pendingAction

    expect(action).toHaveBeenCalledTimes(outcome === 'cancel' ? 1 : 0)
    expect(actionStartedWhileQuitting).toBe(false)
  }
)

it('retries a null bootstrap only after a canceled quit was observed during bootstrap', async () => {
  const { lifecycle, handlers } = createLifecycle()
  const beforeQuit = handlers.get('before-quit')!
  const willQuit = handlers.get('will-quit')!
  let resolveFirstBootstrap!: (value: null) => void
  const firstBootstrap = new Promise<null>((resolve) => {
    resolveFirstBootstrap = resolve
  })
  let bootstrapCalls = 0

  beforeQuit({ defaultPrevented: false } as never)
  const runtimePromise = lifecycle.runBootstrap(async (isActive) => {
    bootstrapCalls += 1
    if (bootstrapCalls === 1) {
      expect(isActive()).toBe(false)

      return firstBootstrap
    }
    expect(isActive()).toBe(true)

    return 'runtime'
  })
  await Promise.resolve()
  resolveFirstBootstrap(null)
  await Promise.resolve()
  willQuit({ defaultPrevented: true } as never)
  const runtime = await runtimePromise

  expect(runtime).toBe('runtime')
  expect(bootstrapCalls).toBe(2)
})

it('does not retry bootstrap after quit commits while bootstrap is pending', async () => {
  const { lifecycle, handlers } = createLifecycle()
  const beforeQuit = handlers.get('before-quit')!
  const quit = handlers.get('quit')!
  let bootstrapCalls = 0

  beforeQuit({ defaultPrevented: false } as never)
  const runtime = lifecycle.runBootstrap(async (isActive) => {
    bootstrapCalls += 1
    expect(isActive()).toBe(false)

    return null
  })
  quit()

  await expect(runtime).resolves.toBeNull()
  expect(bootstrapCalls).toBe(1)
})

it('owned document load failure clears the window, IPC, and exits nonzero', async () => {
  const { lifecycle, app } = createLifecycle()
  const { window, destroy } = createWindow()
  const disposeAuthIpc = vi.fn()

  lifecycle.publishWindow(window, disposeAuthIpc)
  lifecycle.registerWindow(window)(Promise.reject(new Error('synthetic load failure')))
  await vi.waitFor(() => expect(app.exit).toHaveBeenCalledExactlyOnceWith(1))

  expect(lifecycle.getWindow()).toBeNull()
  expect(disposeAuthIpc).toHaveBeenCalledOnce()
  expect(destroy).toHaveBeenCalledOnce()
})

it('load failure held by a canceled close is handled after close cancellation', async () => {
  const { lifecycle, app } = createLifecycle()
  const { window, handlers, destroy } = createWindow()
  const disposeAuthIpc = vi.fn()
  let rejectLoad!: (error: unknown) => void
  const load = new Promise<void>((_resolve, reject) => {
    rejectLoad = reject
  })

  lifecycle.publishWindow(window, disposeAuthIpc)
  lifecycle.registerWindow(window)(load)
  rejectLoad(new Error('synthetic canceled-close load failure'))
  let defaultPrevented = false
  const closeEvent = {
    get defaultPrevented() {
      return defaultPrevented
    }
  } as QuitEvent
  handlers.get('close')!(closeEvent as never)
  defaultPrevented = true
  await load.catch(() => undefined)
  await Promise.resolve()

  expect(app.exit).toHaveBeenCalledExactlyOnceWith(1)
  expect(disposeAuthIpc).toHaveBeenCalledOnce()
  expect(destroy).toHaveBeenCalledOnce()
})

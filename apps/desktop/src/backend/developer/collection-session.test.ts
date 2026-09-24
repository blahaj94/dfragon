import { expect, it, vi } from 'vitest'
import { createDeveloperCollectionSession, type CapturedPartyFrame } from './collection-session'

const capturedAt = '2026-09-25T12:30:00.000Z'

function frame(
  slots: CapturedPartyFrame['slots'] = [
    { slot: 1, width: 2, height: 1, rgba: Buffer.alloc(8, 1) },
    { slot: 2, width: 2, height: 1, rgba: Buffer.alloc(8, 2) },
    { slot: 3, width: 2, height: 1, rgba: Buffer.alloc(8, 3) },
    { slot: 4, width: 2, height: 1, rgba: Buffer.alloc(8, 4) }
  ]
): CapturedPartyFrame {
  return { width: 1920, height: 1080, scale: 1.285714, capturedAt, slots }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function setup(
  options: {
    enabled?: boolean
    trusted?: () => boolean
    foreground?: () => boolean
    capture?: () => Promise<CapturedPartyFrame>
    save?: (sample: unknown, shouldCommit: () => boolean) => Promise<unknown>
  } = {}
): {
  session: ReturnType<typeof createDeveloperCollectionSession>
  store: {
    getSettings: ReturnType<typeof vi.fn>
    addCollectedSample: ReturnType<typeof vi.fn>
  }
  registerPrintScreen: ReturnType<typeof vi.fn>
  unregisterPrintScreen: ReturnType<typeof vi.fn>
  capturePartyFrame: ReturnType<typeof vi.fn>
  encodePng: ReturnType<typeof vi.fn>
  pressPrintScreen: () => void
} {
  const store = {
    getSettings: vi.fn(async () => ({ enabled: options.enabled ?? true })),
    addCollectedSample: vi.fn(options.save ?? (async () => ({ id: 'saved' })))
  }
  let printScreen: (() => void) | null = null
  const registerPrintScreen = vi.fn((listener: () => void) => {
    printScreen = listener
    return true
  })
  const unregisterPrintScreen = vi.fn(() => {
    printScreen = null
  })
  const capturePartyFrame = vi.fn(options.capture ?? (async () => frame()))
  const encodePng = vi.fn((rgba: Buffer) => Buffer.from(rgba))
  const session = createDeveloperCollectionSession({
    store,
    capturePartyFrame,
    isDnfForeground: options.foreground ?? (() => true),
    isTrustedContext: options.trusted ?? (() => true),
    registerPrintScreen,
    unregisterPrintScreen,
    encodePng
  })

  return {
    session,
    store,
    registerPrintScreen,
    unregisterPrintScreen,
    capturePartyFrame,
    encodePng,
    pressPrintScreen: () => printScreen?.()
  }
}

async function settleCapture(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

it('captures fresh raw crops and saves only the selected party slots', async () => {
  const fixture = setup()
  const currentFrame = frame()
  fixture.capturePartyFrame.mockResolvedValue(currentFrame)

  const status = await fixture.session.setSlots([2, 4])
  expect(status).toMatchObject({ armed: true, slots: [2, 4], revision: 0 })

  fixture.pressPrintScreen()
  await settleCapture()

  expect(fixture.capturePartyFrame).toHaveBeenCalledTimes(1)
  expect(fixture.store.addCollectedSample).toHaveBeenCalledTimes(2)
  expect(fixture.store.addCollectedSample.mock.calls.map(([sample]) => sample)).toEqual([
    {
      png: Buffer.alloc(8, 2),
      capturedAt,
      source: { slot: 2, frameWidth: 1920, frameHeight: 1080, scale: 1.285714 }
    },
    {
      png: Buffer.alloc(8, 4),
      capturedAt,
      source: { slot: 4, frameWidth: 1920, frameHeight: 1080, scale: 1.285714 }
    }
  ])
  expect(fixture.session.getStatus()).toMatchObject({
    armed: true,
    revision: 2,
    lastSavedAt: capturedAt,
    error: null
  })
})

it('does not capture with no selected slots and does not collect outside trusted game focus', async () => {
  const trusted = { value: true }
  const foreground = { value: true }
  const fixture = setup({
    trusted: () => trusted.value,
    foreground: () => foreground.value
  })

  await fixture.session.setSlots([])
  fixture.pressPrintScreen()
  await settleCapture()
  expect(fixture.capturePartyFrame).not.toHaveBeenCalled()
  expect(fixture.store.addCollectedSample).not.toHaveBeenCalled()

  await fixture.session.setSlots([1])
  trusted.value = false
  fixture.pressPrintScreen()
  await settleCapture()
  expect(fixture.capturePartyFrame).not.toHaveBeenCalled()

  trusted.value = true
  foreground.value = false
  fixture.pressPrintScreen()
  await settleCapture()
  expect(fixture.capturePartyFrame).not.toHaveBeenCalled()
  expect(fixture.session.getStatus()).toMatchObject({
    error: 'DEVELOPER_GAME_NOT_FOREGROUND',
    revision: 1
  })
})

it('cancels a pending capture when the session is disabled before it can write', async () => {
  const pendingFrame = deferred<CapturedPartyFrame>()
  let markCaptureStarted!: () => void
  const captureStarted = new Promise<void>((resolve) => {
    markCaptureStarted = resolve
  })
  const fixture = setup({
    capture: () => {
      markCaptureStarted()
      return pendingFrame.promise
    }
  })

  await fixture.session.setSlots([1, 2])
  fixture.pressPrintScreen()
  await captureStarted

  const disabling = fixture.session.beginDisable()
  pendingFrame.resolve(frame())
  await disabling

  expect(fixture.unregisterPrintScreen).toHaveBeenCalledTimes(1)
  expect(fixture.store.addCollectedSample).not.toHaveBeenCalled()
  expect(fixture.session.getStatus()).toMatchObject({ armed: false, slots: [] })
})

it('surfaces a later crop write failure while keeping earlier saved data discoverable', async () => {
  const save = vi
    .fn()
    .mockResolvedValueOnce({ id: 'first' })
    .mockRejectedValueOnce(new Error('disk full'))
  const fixture = setup({ save })
  await fixture.session.setSlots([1, 2])
  fixture.pressPrintScreen()
  await settleCapture()

  expect(fixture.store.addCollectedSample).toHaveBeenCalledTimes(2)
  expect(fixture.session.getStatus()).toMatchObject({
    armed: true,
    revision: 2,
    lastSavedAt: capturedAt,
    error: 'DEVELOPER_OPERATION_FAILED'
  })
})

it('invalidates an arm request when a newer disarm arrives during the settings check', async () => {
  const settings = deferred<{ enabled: boolean }>()
  const fixture = setup({ enabled: true })
  fixture.store.getSettings.mockReturnValueOnce(settings.promise)

  const arming = fixture.session.setSlots([1])
  const disarming = fixture.session.setSlots(null)
  settings.resolve({ enabled: true })
  await Promise.all([arming, disarming])

  expect(fixture.registerPrintScreen).not.toHaveBeenCalled()
  expect(fixture.session.getStatus()).toMatchObject({ armed: false, slots: [] })
})

it('does not let an arm waiting on settings register after developer mode starts disabling', async () => {
  const settings = deferred<{ enabled: boolean }>()
  const fixture = setup()
  fixture.store.getSettings.mockReturnValueOnce(settings.promise)

  const arming = fixture.session.setSlots([1])
  const disabling = fixture.session.beginDisable()
  settings.resolve({ enabled: true })
  await Promise.all([arming, disabling])

  expect(fixture.registerPrintScreen).not.toHaveBeenCalled()
  expect(fixture.session.getStatus()).toMatchObject({ armed: false, slots: [] })
})

it('publishes a completed sample revision even if its save promise settles during disarm', async () => {
  const saveResult = deferred<unknown>()
  let markSaveStarted!: () => void
  const saveStarted = new Promise<void>((resolve) => {
    markSaveStarted = resolve
  })
  const fixture = setup({
    save: async () => {
      markSaveStarted()
      return saveResult.promise
    }
  })

  await fixture.session.setSlots([1])
  fixture.pressPrintScreen()
  await saveStarted
  const disarming = fixture.session.setSlots(null)
  saveResult.resolve({ id: 'committed-before-disarm' })
  await disarming

  expect(fixture.session.getStatus()).toMatchObject({
    armed: false,
    revision: 1,
    lastSavedAt: capturedAt
  })
})

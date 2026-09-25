import { expect, it, vi } from 'vitest'
import {
  createDeveloperCollectionSession,
  validatePartyFrame,
  type CapturedPartyFrame
} from './collection-session'

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

it('stops frame validation after invalid dimensions without reading scale', () => {
  const invalidFrame = {
    width: 0,
    height: 1080,
    get scale() {
      throw new Error('scale was read before dimensions passed')
    }
  }

  expect(() => validatePartyFrame(invalidFrame)).toThrowError('DEVELOPER_CAPTURE_UNAVAILABLE')
})

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
    prepareUpload?: NonNullable<
      Parameters<typeof createDeveloperCollectionSession>[0]['prepareUpload']
    >
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
    encodePng,
    prepareUpload: options.prepareUpload
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

it('uploads one saved capture, keeps local crops on failure and aborts on leaving collection', async () => {
  const pending = deferred<import('../../preload/common/types/developer').DeveloperUploadStatus>()
  const send = vi.fn(
    async (_frame: CapturedPartyFrame, _slots: number[], _kind: string, signal: AbortSignal) => {
      signal.addEventListener('abort', () => pending.resolve('failed'), { once: true })
      return pending.promise
    }
  )
  const fixture = setup({ prepareUpload: () => send })
  await fixture.session.setSlots([3], 'participants')
  fixture.pressPrintScreen()
  await settleCapture()
  expect(fixture.store.addCollectedSample).toHaveBeenCalledOnce()
  expect(send).toHaveBeenCalledWith(
    expect.any(Object),
    [3],
    'participants',
    expect.any(AbortSignal)
  )
  expect(fixture.session.getStatus()).toMatchObject({ lastSavedCount: 1, upload: 'uploading' })
  fixture.pressPrintScreen()
  expect(send).toHaveBeenCalledOnce()
  await fixture.session.stop()
  expect(send.mock.calls[0][3].aborted).toBe(true)
  expect(fixture.session.getStatus()).not.toHaveProperty('upload')
  expect(fixture.store.addCollectedSample).toHaveBeenCalledOnce()
})

it('does not upload a capture made before login or after a local save failure', async () => {
  const pending = deferred<CapturedPartyFrame>()
  const send = vi.fn(async () => 'uploaded' as const)
  const prepare = vi.fn<
    NonNullable<Parameters<typeof createDeveloperCollectionSession>[0]['prepareUpload']>
  >(() => null)
  const fixture = setup({ capture: () => pending.promise, prepareUpload: prepare })
  await fixture.session.setSlots([3])
  fixture.pressPrintScreen()
  prepare.mockReturnValue(send)
  pending.resolve(frame())
  await settleCapture()
  expect(send).not.toHaveBeenCalled()
  expect(fixture.session.getStatus()).toMatchObject({ lastSavedCount: 1, upload: 'signedOut' })
  fixture.store.addCollectedSample.mockRejectedValueOnce(new Error('DEVELOPER_STORAGE_UNAVAILABLE'))
  fixture.pressPrintScreen()
  await settleCapture()
  expect(send).not.toHaveBeenCalled()
})

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

it.each([[1], [2, 4]])(
  'saves detected slots %j even when empty positions are also selected',
  async (...detectedSlots) => {
    const detected = frame().slots.filter(({ slot }) => detectedSlots.includes(slot))
    const fixture = setup({ capture: async () => frame(detected) })
    await fixture.session.setSlots([1, 2, 3, 4])

    fixture.pressPrintScreen()
    await settleCapture()

    expect(fixture.store.addCollectedSample).toHaveBeenCalledTimes(detected.length)
    expect(
      fixture.store.addCollectedSample.mock.calls.map(([sample]) => sample.source.slot)
    ).toEqual(detectedSlots)
    expect(fixture.encodePng.mock.calls.map(([rgba]) => rgba)).toEqual(
      detected.map(({ rgba }) => rgba)
    )
    expect(fixture.session.getStatus()).toMatchObject({
      armed: true,
      revision: detected.length,
      lastSavedAt: capturedAt,
      error: null
    })
  }
)

it('does not save unselected frames when none of the selected slots is detected', async () => {
  const fixture = setup({ capture: async () => frame([frame().slots[0]]) })
  await fixture.session.setSlots([2, 3, 4])

  fixture.pressPrintScreen()
  await settleCapture()

  expect(fixture.encodePng).not.toHaveBeenCalled()
  expect(fixture.store.addCollectedSample).not.toHaveBeenCalled()
  expect(fixture.session.getStatus()).toMatchObject({
    armed: true,
    revision: 1,
    lastSavedAt: null,
    error: 'DEVELOPER_PARTY_SLOTS_NOT_FOUND'
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

it('switches capture kind without saving a pending crop from the previous tab', async () => {
  const pending = deferred<CapturedPartyFrame>()
  const fixture = setup()
  fixture.capturePartyFrame.mockReturnValueOnce(pending.promise)
  await fixture.session.setSlots([1, 2, 3, 4], 'hud')
  fixture.pressPrintScreen()
  await settleCapture()
  expect(fixture.capturePartyFrame).toHaveBeenLastCalledWith('hud')

  await fixture.session.setSlots([1, 2, 3, 4], 'participants')
  pending.resolve(frame())
  await settleCapture()
  expect(fixture.store.addCollectedSample).not.toHaveBeenCalled()

  const sparse = frame([
    { slot: 3, width: 2, height: 1, rgba: Buffer.from([1, 2, 3, 255, 5, 6, 7, 255]) }
  ])
  fixture.capturePartyFrame.mockResolvedValue(sparse)
  fixture.pressPrintScreen()
  await settleCapture()
  expect(fixture.capturePartyFrame).toHaveBeenLastCalledWith('participants')
  expect(fixture.store.addCollectedSample).toHaveBeenCalledTimes(1)
  expect(fixture.store.addCollectedSample.mock.calls[0][0]).toMatchObject({
    source: { slot: 3 },
    png: sparse.slots[0].rgba
  })
  expect(fixture.session.getStatus()).toMatchObject({ lastSavedCount: 1, error: null })
})

it('reports a partial save without claiming the remaining nicknames succeeded', async () => {
  const fixture = setup()
  fixture.store.addCollectedSample
    .mockResolvedValueOnce({ id: 'saved' })
    .mockRejectedValueOnce(new Error('DEVELOPER_STORAGE_UNAVAILABLE'))
  await fixture.session.setSlots([1, 2, 3, 4], 'participants')
  fixture.pressPrintScreen()
  await settleCapture()
  expect(fixture.session.getStatus()).toMatchObject({
    lastSavedCount: 1,
    error: 'DEVELOPER_STORAGE_UNAVAILABLE'
  })
  expect(fixture.store.addCollectedSample).toHaveBeenCalledTimes(2)
})

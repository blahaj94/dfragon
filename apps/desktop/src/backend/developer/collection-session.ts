import type {
  DeveloperPartyCollectionStatus,
  DeveloperPartyPreviewFrame,
  DeveloperPartySlot
} from '../../preload/common/types/developer'
import { isCanonicalIsoTimestamp, isValidImageDimensions } from './validation'

export type CapturedPartySlot = {
  slot: DeveloperPartySlot
  width: number
  height: number
  rgba: Buffer
}

export type CapturedPartyFrame = {
  width: number
  height: number
  scale: number
  capturedAt: string
  slots: CapturedPartySlot[]
}

type CollectionSampleInput = {
  png: Buffer
  capturedAt: string
  source: {
    slot: DeveloperPartySlot
    frameWidth: number
    frameHeight: number
    scale: number
  }
}

type CollectionStore = {
  getSettings: () => Promise<{ enabled: boolean }>
  addCollectedSample: (
    sample: CollectionSampleInput,
    shouldCommit: () => boolean
  ) => Promise<unknown>
}

type CollectionSessionOptions = {
  store: CollectionStore
  capturePartyFrame: () => Promise<CapturedPartyFrame>
  isDnfForeground: () => boolean | Promise<boolean>
  isTrustedContext: () => boolean
  registerPrintScreen: (listener: () => void) => boolean
  unregisterPrintScreen: () => void
  encodePng: (rgba: Buffer, width: number, height: number) => Buffer
}

type CollectionSession = {
  setSlots: (slots: DeveloperPartySlot[] | null) => Promise<DeveloperPartyCollectionStatus>
  beginDisable: () => Promise<void>
  setArmingEnabled: (enabled: boolean) => void
  stop: () => Promise<void>
  dispose: () => Promise<void>
  getStatus: () => DeveloperPartyCollectionStatus
}

const PARTY_SLOTS = new Set<DeveloperPartySlot>([1, 2, 3, 4])

function isPartySlot(value: unknown): value is DeveloperPartySlot {
  return value === 1 || value === 2 || value === 3 || value === 4
}

function isValidScale(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function validatePartyFrame(value: unknown): asserts value is CapturedPartyFrame {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
  }
  const frame = value as Record<string, unknown>
  if (!isValidImageDimensions(frame.width, frame.height)) {
    throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
  }
  if (!isValidScale(frame.scale)) {
    throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
  }
  if (!isCanonicalIsoTimestamp(frame.capturedAt)) {
    throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
  }
  if (!Array.isArray(frame.slots) || frame.slots.length > 4) {
    throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
  }

  const seenSlots = new Set<number>()
  for (const value of frame.slots) {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
    }
    const slot = value as Record<string, unknown>
    const width = typeof slot.width === 'number' ? slot.width : Number.NaN
    const height = typeof slot.height === 'number' ? slot.height : Number.NaN
    const rgba = slot.rgba
    if (
      !isPartySlot(slot.slot) ||
      seenSlots.has(slot.slot) ||
      !isValidImageDimensions(width, height) ||
      !Buffer.isBuffer(rgba) ||
      rgba.length !== width * height * 4
    ) {
      throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
    }
    seenSlots.add(slot.slot)
  }
}

export function previewFrame(frame: CapturedPartyFrame): DeveloperPartyPreviewFrame {
  validatePartyFrame(frame)
  return {
    width: frame.width,
    height: frame.height,
    scale: frame.scale,
    capturedAt: frame.capturedAt,
    slots: frame.slots.map(({ slot, width, height, rgba }) => ({
      slot,
      width,
      height,
      rgba: Uint8Array.from(rgba)
    }))
  }
}

const PUBLIC_ERROR_CODES = new Set([
  'DEVELOPER_DISABLED',
  'DEVELOPER_STORAGE_UNAVAILABLE',
  'DEVELOPER_CAPTURE_UNAVAILABLE',
  'DEVELOPER_HOTKEY_UNAVAILABLE',
  'DEVELOPER_ADMIN_REQUIRED',
  'DEVELOPER_GAME_NOT_FOREGROUND',
  'DEVELOPER_PARTY_SLOTS_NOT_FOUND'
])

function publicErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  return PUBLIC_ERROR_CODES.has(message) ? message : 'DEVELOPER_OPERATION_FAILED'
}

export function createDeveloperCollectionSession({
  store,
  capturePartyFrame,
  isDnfForeground,
  isTrustedContext,
  registerPrintScreen,
  unregisterPrintScreen,
  encodePng
}: CollectionSessionOptions): CollectionSession {
  let disposed = false
  let armingEnabled = true
  let armed = false
  let slots: DeveloperPartySlot[] = []
  let generation = 0
  let printScreenRegistered = false
  let pendingCapture: Promise<void> | null = null
  let requestToken = 0
  let error: string | null = null
  let revision = 0
  let lastSavedAt: string | null = null

  function getStatus(): DeveloperPartyCollectionStatus {
    return { armed, slots: [...slots], revision, lastSavedAt, error }
  }

  function isTrusted(): boolean {
    try {
      return !disposed && isTrustedContext()
    } catch {
      return false
    }
  }

  function isCurrentCapture(captureGeneration: number): boolean {
    return armed && generation === captureGeneration && isTrusted()
  }

  function removePrintScreen(): void {
    if (!printScreenRegistered) {
      return
    }
    printScreenRegistered = false
    try {
      unregisterPrintScreen()
    } catch {
      // Session state is already invalidated, so a failed platform unregister cannot save data.
    }
  }

  function invalidate(): void {
    generation += 1
    armed = false
    slots = []
    removePrintScreen()
  }

  async function collect(
    captureGeneration: number,
    selectedSlots: DeveloperPartySlot[]
  ): Promise<void> {
    try {
      const settings = await store.getSettings()
      if (!isCurrentCapture(captureGeneration)) {
        return
      }
      if (!settings.enabled) {
        throw new Error('DEVELOPER_DISABLED')
      }
      if (!(await isDnfForeground())) {
        throw new Error('DEVELOPER_GAME_NOT_FOREGROUND')
      }

      const frameValue = await capturePartyFrame()
      if (!isCurrentCapture(captureGeneration)) {
        return
      }
      validatePartyFrame(frameValue)
      if (!(await isDnfForeground())) {
        throw new Error('DEVELOPER_GAME_NOT_FOREGROUND')
      }

      const slotsByNumber = new Map(frameValue.slots.map((slot) => [slot.slot, slot]))
      const missingSlots = selectedSlots.filter((slot) => !slotsByNumber.has(slot))
      if (missingSlots.length > 0) {
        throw new Error('DEVELOPER_PARTY_SLOTS_NOT_FOUND')
      }
      const selected = selectedSlots.map((slot) => slotsByNumber.get(slot)!)

      for (const slot of selected) {
        if (!isCurrentCapture(captureGeneration)) {
          return
        }
        const png = encodePng(slot.rgba, slot.width, slot.height)
        await store.addCollectedSample(
          {
            png,
            capturedAt: frameValue.capturedAt,
            source: {
              slot: slot.slot,
              frameWidth: frameValue.width,
              frameHeight: frameValue.height,
              scale: frameValue.scale
            }
          },
          () => isCurrentCapture(captureGeneration)
        )
        lastSavedAt = frameValue.capturedAt
        revision += 1
        if (!isCurrentCapture(captureGeneration)) {
          return
        }
      }
      error = null
    } catch (caughtError) {
      if (!isCurrentCapture(captureGeneration)) {
        return
      }
      error = publicErrorCode(caughtError)
      revision += 1
    }
  }

  function onPrintScreen(): void {
    if (!armed || disposed || pendingCapture != null || slots.length === 0 || !isTrusted()) {
      return
    }
    const captureGeneration = generation
    const selectedSlots = [...slots]
    const capture = collect(captureGeneration, selectedSlots)
    pendingCapture = capture
    void capture.finally(() => {
      if (pendingCapture === capture) {
        pendingCapture = null
      }
    })
  }

  async function waitForCapture(): Promise<void> {
    const capture = pendingCapture
    if (capture != null) {
      await capture
    }
  }

  async function setSlots(
    selectedSlots: DeveloperPartySlot[] | null
  ): Promise<DeveloperPartyCollectionStatus> {
    if (disposed) {
      return getStatus()
    }

    requestToken += 1
    const token = requestToken
    invalidate()
    error = null
    if (selectedSlots == null) {
      await waitForCapture()
      return getStatus()
    }

    if (!armingEnabled) {
      error = 'DEVELOPER_DISABLED'
      revision += 1
      return getStatus()
    }

    if (
      new Set(selectedSlots).size !== selectedSlots.length ||
      selectedSlots.some((slot) => !PARTY_SLOTS.has(slot))
    ) {
      error = 'DEVELOPER_INVALID_COMMAND'
      revision += 1
      return getStatus()
    }

    const captureGeneration = generation
    try {
      const settings = await store.getSettings()
      if (disposed || token !== requestToken || captureGeneration !== generation) {
        return getStatus()
      }
      if (!isTrusted()) {
        invalidate()
        return getStatus()
      }
      if (!settings.enabled) {
        error = 'DEVELOPER_DISABLED'
        revision += 1
        return getStatus()
      }

      const registered = registerPrintScreen(onPrintScreen)
      if (!registered) {
        error = 'DEVELOPER_HOTKEY_UNAVAILABLE'
        revision += 1
        return getStatus()
      }
      printScreenRegistered = true
      slots = [...selectedSlots]
      armed = true
      error = null
      return getStatus()
    } catch (caughtError) {
      if (!disposed && token === requestToken && captureGeneration === generation) {
        error = publicErrorCode(caughtError)
        revision += 1
      }
      return getStatus()
    }
  }

  async function stop(): Promise<void> {
    if (!disposed) {
      requestToken += 1
      invalidate()
    }
    await waitForCapture()
  }

  async function beginDisable(): Promise<void> {
    armingEnabled = false
    requestToken += 1
    invalidate()
    await waitForCapture()
  }

  function setArmingEnabled(enabled: boolean): void {
    armingEnabled = enabled
  }

  async function dispose(): Promise<void> {
    if (!disposed) {
      disposed = true
      requestToken += 1
      invalidate()
    }
    await waitForCapture()
  }

  return { setSlots, beginDisable, setArmingEnabled, stop, dispose, getStatus }
}

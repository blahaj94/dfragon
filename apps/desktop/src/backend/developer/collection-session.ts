import { DEVELOPER_ERROR_CODES } from '../../preload/common/developer-errors'
import type {
  DeveloperCollectionKind,
  DeveloperParticipantWindow,
  DeveloperPartyCollectionStatus,
  DeveloperPartyPreviewFrame,
  DeveloperPartySlot,
  DeveloperSampleSource,
  DeveloperUploadStatus
} from '../../preload/common/types/developer'
import {
  DEVELOPER_COLLECTION_SLOTS,
  isDeveloperCollectionKind,
  isDeveloperPartySlot
} from '../../preload/common/developer-collection'
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
  participantWindow?: DeveloperParticipantWindow
  // Kept in main only. Preview IPC intentionally omits the source pixels and coordinates.
  original?: {
    rgba: Buffer
    crops: { slot: DeveloperPartySlot; x: number; y: number; width: number; height: number }[]
  }
}

type CollectionSampleInput = {
  png: Buffer
  capturedAt: string
  source: DeveloperSampleSource
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
  capturePartyFrame: (kind: DeveloperCollectionKind) => Promise<CapturedPartyFrame>
  isDnfForeground: () => boolean | Promise<boolean>
  isTrustedContext: () => boolean
  registerPrintScreen: (listener: () => void) => boolean
  unregisterPrintScreen: () => void
  encodePng: (rgba: Buffer, width: number, height: number) => Buffer
  prepareUpload?: () =>
    | ((
        frame: CapturedPartyFrame,
        slots: DeveloperPartySlot[],
        kind: DeveloperCollectionKind,
        signal: AbortSignal
      ) => Promise<DeveloperUploadStatus>)
    | null
}

type CollectionSession = {
  setSlots: (
    slots: DeveloperPartySlot[] | null,
    kind?: DeveloperCollectionKind
  ) => Promise<DeveloperPartyCollectionStatus>
  beginDisable: () => Promise<void>
  setArmingEnabled: (enabled: boolean) => void
  stop: () => Promise<void>
  dispose: () => Promise<void>
  getStatus: () => DeveloperPartyCollectionStatus
}

function isValidScale(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function validatePartyFrame(
  value: unknown,
  kind: DeveloperCollectionKind = 'hud'
): asserts value is CapturedPartyFrame {
  if (!isDeveloperCollectionKind(kind)) {
    throw new Error(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
  }
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
  }
  const frame = value as Record<string, unknown>
  if (!isValidImageDimensions(frame.width, frame.height)) {
    throw new Error(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
  }
  if (!isValidScale(frame.scale)) {
    throw new Error(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
  }
  if (!isCanonicalIsoTimestamp(frame.capturedAt)) {
    throw new Error(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
  }
  if (!Array.isArray(frame.slots) || frame.slots.length > DEVELOPER_COLLECTION_SLOTS[kind].length) {
    throw new Error(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
  }

  const seenSlots = new Set<number>()
  for (const value of frame.slots) {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
    }
    const slot = value as Record<string, unknown>
    const width = typeof slot.width === 'number' ? slot.width : Number.NaN
    const height = typeof slot.height === 'number' ? slot.height : Number.NaN
    const rgba = slot.rgba
    if (
      !isDeveloperPartySlot(slot.slot, kind) ||
      seenSlots.has(slot.slot) ||
      !isValidImageDimensions(width, height) ||
      !Buffer.isBuffer(rgba) ||
      rgba.length !== width * height * 4
    ) {
      throw new Error(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
    }
    seenSlots.add(slot.slot)
  }

  if (frame.participantWindow != null) {
    validateParticipantPreview(frame.participantWindow, kind, seenSlots)
  }
}

function validateParticipantPreview(
  value: unknown,
  kind: DeveloperCollectionKind,
  occupiedSlots: ReadonlySet<number>
): void {
  if (kind === 'hud' || value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
  }
  const popup = value as Record<string, unknown>
  const width = typeof popup.width === 'number' ? popup.width : Number.NaN
  const height = typeof popup.height === 'number' ? popup.height : Number.NaN
  if (
    !isValidImageDimensions(width, height) ||
    !(popup.rgba instanceof Uint8Array) ||
    popup.rgba.length !== width * height * 4 ||
    !Array.isArray(popup.rows) ||
    popup.rows.length !== DEVELOPER_COLLECTION_SLOTS[kind].length
  ) {
    throw new Error(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
  }
  for (const [index, value] of popup.rows.entries()) {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
    }
    const row = value as Record<string, unknown>
    const x = typeof row.x === 'number' ? row.x : Number.NaN
    const y = typeof row.y === 'number' ? row.y : Number.NaN
    const rowWidth = typeof row.width === 'number' ? row.width : Number.NaN
    const rowHeight = typeof row.height === 'number' ? row.height : Number.NaN
    if (
      row.slot !== index + 1 ||
      typeof row.occupied !== 'boolean' ||
      row.occupied !== occupiedSlots.has(index + 1) ||
      !Number.isSafeInteger(x) ||
      !Number.isSafeInteger(y) ||
      x < 0 ||
      y < 0 ||
      !isValidImageDimensions(rowWidth, rowHeight) ||
      x + rowWidth > width ||
      y + rowHeight > height
    ) {
      throw new Error(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
    }
  }
}

export function previewFrame(
  frame: CapturedPartyFrame,
  kind: DeveloperCollectionKind = 'hud'
): DeveloperPartyPreviewFrame {
  validatePartyFrame(frame, kind)
  return {
    width: frame.width,
    height: frame.height,
    scale: frame.scale,
    capturedAt: frame.capturedAt,
    ...(frame.participantWindow
      ? {
          participantWindow: {
            ...frame.participantWindow,
            rgba: Uint8Array.from(frame.participantWindow.rgba)
          }
        }
      : {}),
    slots: frame.slots.map(({ slot, width, height, rgba }) => ({
      slot,
      width,
      height,
      rgba: Uint8Array.from(rgba)
    }))
  }
}

const PUBLIC_ERROR_CODES = new Set<string>([
  DEVELOPER_ERROR_CODES.DISABLED,
  DEVELOPER_ERROR_CODES.STORAGE_UNAVAILABLE,
  DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE,
  DEVELOPER_ERROR_CODES.HOTKEY_UNAVAILABLE,
  DEVELOPER_ERROR_CODES.ADMIN_REQUIRED,
  DEVELOPER_ERROR_CODES.GAME_NOT_FOREGROUND,
  DEVELOPER_ERROR_CODES.PARTY_SLOTS_NOT_FOUND,
  DEVELOPER_ERROR_CODES.GAME_NOT_FOUND,
  DEVELOPER_ERROR_CODES.PARTICIPANT_WINDOW_NOT_FOUND,
  DEVELOPER_ERROR_CODES.PARTICIPANT_WINDOW_UNCERTAIN,
  DEVELOPER_ERROR_CODES.RAID_WINDOW_NOT_FOUND,
  DEVELOPER_ERROR_CODES.RAID_WINDOW_UNCERTAIN
])

function publicErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  return PUBLIC_ERROR_CODES.has(message) ? message : DEVELOPER_ERROR_CODES.OPERATION_FAILED
}

export function createDeveloperCollectionSession({
  store,
  capturePartyFrame,
  isDnfForeground,
  isTrustedContext,
  registerPrintScreen,
  unregisterPrintScreen,
  encodePng,
  prepareUpload
}: CollectionSessionOptions): CollectionSession {
  let disposed = false
  let armingEnabled = true
  let armed = false
  let slots: DeveloperPartySlot[] = []
  let kind: DeveloperCollectionKind = 'hud'
  let lastSavedCount = 0
  let generation = 0
  let printScreenRegistered = false
  let pendingCapture: Promise<void> | null = null
  let requestToken = 0
  let error: string | null = null
  let revision = 0
  let lastSavedAt: string | null = null
  let upload: DeveloperUploadStatus | undefined
  let uploadController: AbortController | null = null

  function getStatus(): DeveloperPartyCollectionStatus {
    return {
      armed,
      slots: [...slots],
      revision,
      lastSavedAt,
      lastSavedCount,
      error,
      ...(upload ? { upload } : {})
    }
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
    uploadController?.abort()
    upload = undefined
    generation += 1
    armed = false
    slots = []
    removePrintScreen()
  }

  async function collect(
    captureGeneration: number,
    selectedSlots: DeveloperPartySlot[],
    captureKind: DeveloperCollectionKind
  ): Promise<void> {
    // Capture authorization when the user presses the key, never after a later login.
    const sendUpload = prepareUpload?.()
    try {
      const settings = await store.getSettings()
      if (!isCurrentCapture(captureGeneration)) {
        return
      }
      if (!settings.enabled) {
        throw new Error(DEVELOPER_ERROR_CODES.DISABLED)
      }
      if (!(await isDnfForeground())) {
        throw new Error(DEVELOPER_ERROR_CODES.GAME_NOT_FOREGROUND)
      }

      const frameValue = await capturePartyFrame(captureKind)
      if (!isCurrentCapture(captureGeneration)) {
        return
      }
      validatePartyFrame(frameValue, captureKind)
      if (!(await isDnfForeground())) {
        throw new Error(DEVELOPER_ERROR_CODES.GAME_NOT_FOREGROUND)
      }

      const selected = frameValue.slots.filter(({ slot }) => selectedSlots.includes(slot))
      if (selected.length === 0) {
        throw new Error(DEVELOPER_ERROR_CODES.PARTY_SLOTS_NOT_FOUND)
      }

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
              kind: captureKind,
              slot: slot.slot,
              frameWidth: frameValue.width,
              frameHeight: frameValue.height,
              scale: frameValue.scale
            }
          },
          () => isCurrentCapture(captureGeneration)
        )
        if (isCurrentCapture(captureGeneration)) {
          lastSavedCount += 1
        }
        lastSavedAt = frameValue.capturedAt
        revision += 1
        if (!isCurrentCapture(captureGeneration)) {
          return
        }
      }
      error = null
      if (prepareUpload) {
        if (sendUpload == null) {
          upload = 'signedOut'
        } else {
          upload = 'uploading'
          const controller = new AbortController()
          uploadController = controller
          try {
            const result = await sendUpload(
              frameValue,
              selectedSlots,
              captureKind,
              controller.signal
            )
            if (isCurrentCapture(captureGeneration)) {
              upload = result
            }
          } finally {
            if (uploadController === controller) {
              uploadController = null
            }
          }
        }
      }
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
    lastSavedCount = 0
    upload = undefined
    const capture = collect(captureGeneration, selectedSlots, kind)
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
    selectedSlots: DeveloperPartySlot[] | null,
    captureKind: DeveloperCollectionKind = 'hud'
  ): Promise<DeveloperPartyCollectionStatus> {
    if (disposed) {
      return getStatus()
    }

    requestToken += 1
    const token = requestToken
    invalidate()
    error = null
    lastSavedCount = 0
    kind = captureKind
    if (selectedSlots == null) {
      await waitForCapture()
      return getStatus()
    }

    if (!armingEnabled) {
      error = DEVELOPER_ERROR_CODES.DISABLED
      revision += 1
      return getStatus()
    }

    if (
      !isDeveloperCollectionKind(captureKind) ||
      !Array.isArray(selectedSlots) ||
      selectedSlots.length > DEVELOPER_COLLECTION_SLOTS[captureKind].length ||
      new Set(selectedSlots).size !== selectedSlots.length ||
      [...selectedSlots].some((slot) => !isDeveloperPartySlot(slot, captureKind))
    ) {
      error = DEVELOPER_ERROR_CODES.INVALID_COMMAND
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
        error = DEVELOPER_ERROR_CODES.DISABLED
        revision += 1
        return getStatus()
      }

      const registered = registerPrintScreen(onPrintScreen)
      if (!registered) {
        error = DEVELOPER_ERROR_CODES.HOTKEY_UNAVAILABLE
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

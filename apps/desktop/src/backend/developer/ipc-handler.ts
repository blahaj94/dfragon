import { DEVELOPER_ERROR_CODES } from '../../preload/common/developer-errors'
import { ipcMain, nativeImage, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import type {
  DeveloperCollectionKind,
  DeveloperFrame,
  DeveloperSettings,
  DeveloperPartySlot,
  DeveloperPartyPreviewResponse
} from '../../preload/common/types/developer'
import { DEVELOPER_CHANNELS } from '../../preload/common/developer-channels'
import { createDeveloperStore, DeveloperStoreError } from './persistence'
import { createDeveloperCollectionSession, previewFrame } from './collection-session'
import { createPrintScreenShortcut } from './print-screen-shortcut'
import { assertDnfShortcutAccess, isDnfForeground } from './win32-party-capture'
import type { AuthCoordinator } from '../auth/types'
import { createOcrUploader } from './ocr-upload'

const PUBLIC_ERROR_CODES = new Set<string>([
  DEVELOPER_ERROR_CODES.NOT_ALLOWED,
  DEVELOPER_ERROR_CODES.INVALID_COMMAND,
  DEVELOPER_ERROR_CODES.DISABLED,
  DEVELOPER_ERROR_CODES.STORAGE_UNAVAILABLE,
  DEVELOPER_ERROR_CODES.SAMPLE_NOT_FOUND,
  DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE,
  DEVELOPER_ERROR_CODES.HOTKEY_UNAVAILABLE,
  DEVELOPER_ERROR_CODES.ADMIN_REQUIRED,
  DEVELOPER_ERROR_CODES.GAME_NOT_FOREGROUND,
  DEVELOPER_ERROR_CODES.PARTY_SLOTS_NOT_FOUND,
  DEVELOPER_ERROR_CODES.GAME_NOT_FOUND,
  DEVELOPER_ERROR_CODES.PARTICIPANT_WINDOW_NOT_FOUND,
  DEVELOPER_ERROR_CODES.PARTICIPANT_WINDOW_UNCERTAIN,
  DEVELOPER_ERROR_CODES.OPERATION_FAILED
])

function invalidCommand(): Error {
  return new Error(DEVELOPER_ERROR_CODES.INVALID_COMMAND)
}

function requireNoArguments(args: unknown[]): void {
  if (args.length !== 0) {
    throw invalidCommand()
  }
}

function requireSingleArgument(args: unknown[]): unknown {
  if (args.length !== 1) {
    throw invalidCommand()
  }
  return args[0]
}

function sanitizedError(error: unknown): Error {
  const message = error instanceof Error ? error.message : ''
  const isPublicCode = PUBLIC_ERROR_CODES.has(message)
  return new Error(isPublicCode ? message : DEVELOPER_ERROR_CODES.OPERATION_FAILED)
}

function exactSampleId(value: unknown): string {
  if (typeof value !== 'string') {
    throw invalidCommand()
  }
  return value
}

function exactLabel(value: unknown): string | null {
  if (value !== null && typeof value !== 'string') {
    throw invalidCommand()
  }
  return value
}

function exactExcluded(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw invalidCommand()
  }
  return value
}

function exactCollectionKind(value: unknown): DeveloperCollectionKind {
  if (value === 'hud' || value === 'participants') {
    return value
  }
  throw invalidCommand()
}

function exactPartySlots(value: unknown): DeveloperPartySlot[] | null {
  if (value === null) {
    return null
  }
  if (!Array.isArray(value)) {
    throw invalidCommand()
  }
  const isPartySlot = (slot: unknown): slot is DeveloperPartySlot =>
    slot === 1 || slot === 2 || slot === 3 || slot === 4
  if (value.some((slot) => !isPartySlot(slot)) || new Set(value).size !== value.length) {
    throw invalidCommand()
  }
  return [...value]
}

function assertTrustedSender(
  event: IpcMainInvokeEvent,
  window: BrowserWindow,
  documentUrl: string,
  isDisposed: () => boolean
): void {
  const isRegistered = !isDisposed()
  const isWindowAlive = isRegistered && !window.isDestroyed()
  const isContentsAlive = isWindowAlive && !window.webContents.isDestroyed()
  const frame = isContentsAlive ? window.webContents.mainFrame : null
  const isMainFrame = frame != null && event.senderFrame === frame
  const isFrameAttached = isMainFrame && !frame.isDestroyed() && !frame.detached
  const hasExactDocument = isFrameAttached && frame.url === documentUrl
  const isExpectedSender = isContentsAlive && event.sender === window.webContents
  if (!hasExactDocument || !isExpectedSender) {
    throw new DeveloperStoreError(DEVELOPER_ERROR_CODES.NOT_ALLOWED)
  }
}

function rgbaToWindowsBitmap(rgba: Buffer, width: number, height: number): Buffer {
  if (rgba.length !== width * height * 4) {
    throw new DeveloperStoreError(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
  }
  const bgra = Buffer.allocUnsafe(rgba.length)
  for (let offset = 0; offset < rgba.length; offset += 4) {
    bgra[offset] = rgba[offset + 2]
    bgra[offset + 1] = rgba[offset + 1]
    bgra[offset + 2] = rgba[offset]
    bgra[offset + 3] = rgba[offset + 3]
  }
  return bgra
}

async function capturePrimaryPng(
  event: IpcMainInvokeEvent,
  window: BrowserWindow,
  documentUrl: string,
  isDisposed: () => boolean
): Promise<Buffer> {
  let hidWindow = false
  let png: Buffer | null = null
  let failureCode: string | null = null
  try {
    const shouldHide = window.isVisible() && !window.isMinimized()
    if (shouldHide) {
      window.hide()
      hidWindow = true
      await new Promise((resolve) => setTimeout(resolve, 100))
      assertTrustedSender(event, window, documentUrl, isDisposed)
    }

    const { capturePrimaryFrame } = await import('./win32-capture')
    const frame = capturePrimaryFrame()
    assertTrustedSender(event, window, documentUrl, isDisposed)
    // Electron bitmap buffers use the Windows native channel order; GDI pixels arrive as RGBA.
    const bitmap = rgbaToWindowsBitmap(frame.rgba, frame.width, frame.height)
    png = nativeImage.createFromBitmap(bitmap, { width: frame.width, height: frame.height }).toPNG()
    if (png.length === 0) {
      throw new DeveloperStoreError(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
    }
  } catch (error) {
    const wasAccessDenied =
      error instanceof DeveloperStoreError && error.code === DEVELOPER_ERROR_CODES.NOT_ALLOWED
    failureCode = wasAccessDenied
      ? DEVELOPER_ERROR_CODES.NOT_ALLOWED
      : DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE
  }

  if (hidWindow) {
    try {
      const isWindowAlive = !window.isDestroyed()
      if (isWindowAlive) {
        window.showInactive()
      }
    } catch {
      failureCode = DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE
    }
  }

  if (failureCode != null) {
    throw new DeveloperStoreError(failureCode)
  }
  if (png == null) {
    throw new DeveloperStoreError(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
  }
  return png
}

export function registerDeveloperWindow(
  window: BrowserWindow,
  rendererDocumentUrl: string,
  rootDir: string,
  auth?: AuthCoordinator
): () => void {
  const store = createDeveloperStore({
    rootDir,
    decodePng: (png) => {
      try {
        const image = nativeImage.createFromBuffer(png)
        return image.isEmpty() ? null : image.getSize()
      } catch {
        return null
      }
    }
  })
  let disposed = false
  let mainFrameNavigating = false
  const registeredChannels: string[] = []
  let partyCaptureModule: Promise<typeof import('./win32-party-capture')> | null = null
  let settingsMutationTail: Promise<void> = Promise.resolve()
  let settingsMutationRevision = 0

  function serializeSettingsMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = settingsMutationTail.then(operation, operation)
    settingsMutationTail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  function getPartyCaptureModule(): Promise<typeof import('./win32-party-capture')> {
    partyCaptureModule ??= import('./win32-party-capture')
    return partyCaptureModule
  }

  function isTrustedMainDocument(): boolean {
    const isWindowAlive = !disposed && !mainFrameNavigating && !window.isDestroyed()
    const isContentsAlive = isWindowAlive && !window.webContents.isDestroyed()
    const frame = isContentsAlive ? window.webContents.mainFrame : null
    return (
      frame != null && !frame.isDestroyed() && !frame.detached && frame.url === rendererDocumentUrl
    )
  }

  function onMainFrameNavigation(
    _event: Electron.Event,
    _navigationUrl: string,
    isInPlace: boolean,
    isMainFrame: boolean
  ): void {
    if (isMainFrame) {
      mainFrameNavigating = !isInPlace
      void collectionSession.stop()
    }
  }

  function onMainFrameNavigated(): void {
    mainFrameNavigating = false
    void collectionSession.stop()
  }

  function onRendererGone(): void {
    mainFrameNavigating = true
    void collectionSession.stop()
  }

  function onLoadFailed(
    _event: Electron.Event,
    _code: number,
    _description: string,
    _url: string,
    isMainFrame: boolean
  ): void {
    if (isMainFrame) {
      onMainFrameNavigated()
    }
  }

  const printScreenShortcut = createPrintScreenShortcut({
    isGameForeground: () => isTrustedMainDocument() && isDnfForeground()
  })

  const collectionSession = createDeveloperCollectionSession({
    store,
    prepareUpload: auth ? createOcrUploader(auth) : () => null,
    capturePartyFrame: async (kind) => (await getPartyCaptureModule()).capturePartyFrame(kind),
    isDnfForeground: async () => (await getPartyCaptureModule()).isDnfForeground(),
    isTrustedContext: isTrustedMainDocument,
    registerPrintScreen: (listener) => {
      assertDnfShortcutAccess()
      return printScreenShortcut.register(listener)
    },
    unregisterPrintScreen: printScreenShortcut.unregister,
    encodePng: (rgba, width, height) =>
      nativeImage
        .createFromBitmap(rgbaToWindowsBitmap(rgba, width, height), { width, height })
        .toPNG()
  })

  async function restoreCollectionAfterFailedDisable(mutation: number): Promise<void> {
    if (mutation !== settingsMutationRevision) {
      return
    }
    try {
      const persistedSettings = await store.getSettings()
      const isCurrentMutation = mutation === settingsMutationRevision
      if (isCurrentMutation && persistedSettings.enabled) {
        collectionSession.setArmingEnabled(true)
      }
    } catch {
      // Keep collection fail-closed when the persisted mode cannot be read.
    }
  }

  function disableDeveloperMode(mutation: number): Promise<DeveloperSettings> {
    // Stop accepting captures immediately, before waiting for earlier settings writes.
    const pendingStop = collectionSession.beginDisable()
    return serializeSettingsMutation(async () => {
      try {
        await pendingStop
        const settings = await store.setEnabled(false)
        if (mutation === settingsMutationRevision) {
          collectionSession.setArmingEnabled(false)
        }
        return settings
      } catch (error) {
        await restoreCollectionAfterFailedDisable(mutation)
        throw error
      }
    })
  }

  function enableDeveloperMode(mutation: number): Promise<DeveloperSettings> {
    return serializeSettingsMutation(async () => {
      const settings = await store.setEnabled(true)
      const isCurrentMutation = mutation === settingsMutationRevision
      if (isCurrentMutation && settings.enabled) {
        collectionSession.setArmingEnabled(true)
      }
      return settings
    })
  }

  function setDeveloperEnabled(enabled: boolean): Promise<DeveloperSettings> {
    settingsMutationRevision += 1
    const mutation = settingsMutationRevision
    return enabled ? enableDeveloperMode(mutation) : disableDeveloperMode(mutation)
  }

  async function invoke<T>(event: IpcMainInvokeEvent, operation: () => Promise<T>): Promise<T> {
    try {
      assertTrustedSender(event, window, rendererDocumentUrl, () => disposed)
      const result = await operation()
      assertTrustedSender(event, window, rendererDocumentUrl, () => disposed)
      return result
    } catch (error) {
      throw sanitizedError(error)
    }
  }

  function register(
    channel: string,
    handler: (event: IpcMainInvokeEvent, args: unknown[]) => Promise<unknown>
  ): void {
    ipcMain.handle(channel, (event, ...args) => handler(event, args))
    registeredChannels.push(channel)
  }

  function dispose(): void {
    if (disposed) {
      return
    }
    disposed = true
    for (const channel of registeredChannels) {
      try {
        ipcMain.removeHandler(channel)
      } catch {
        // Continue unregistering remaining developer IPC channels.
      }
    }
    registeredChannels.length = 0
    window.removeListener('closed', dispose)
    window.webContents.removeListener('destroyed', dispose)
    window.webContents.removeListener('did-start-navigation', onMainFrameNavigation)
    window.webContents.removeListener('did-navigate', onMainFrameNavigated)
    window.webContents.removeListener('did-fail-load', onLoadFailed)
    window.webContents.removeListener('render-process-gone', onRendererGone)
    void collectionSession.dispose()
  }

  try {
    register(DEVELOPER_CHANNELS.getSettings, (event, args) =>
      invoke(event, async () => {
        requireNoArguments(args)
        return store.getSettings()
      })
    )
    register(DEVELOPER_CHANNELS.setEnabled, (event, args) =>
      invoke(event, async () => {
        const enabled = requireSingleArgument(args)
        if (typeof enabled !== 'boolean') {
          throw invalidCommand()
        }
        return setDeveloperEnabled(enabled)
      })
    )
    register(DEVELOPER_CHANNELS.listSamples, (event, args) =>
      invoke(event, async () => {
        requireNoArguments(args)
        return store.listSamples()
      })
    )
    register(DEVELOPER_CHANNELS.readImage, (event, args) =>
      invoke(event, async () => store.readImage(exactSampleId(requireSingleArgument(args))))
    )
    register(DEVELOPER_CHANNELS.addSample, (event, args) =>
      invoke(event, async () => {
        const pngDataUrl = requireSingleArgument(args)
        if (typeof pngDataUrl !== 'string') {
          throw invalidCommand()
        }
        return store.addSample(pngDataUrl)
      })
    )
    register(DEVELOPER_CHANNELS.saveLabel, (event, args) =>
      invoke(event, async () => {
        if (args.length !== 2) {
          throw invalidCommand()
        }
        return store.saveLabel(exactSampleId(args[0]), exactLabel(args[1]))
      })
    )
    register(DEVELOPER_CHANNELS.setSampleExcluded, (event, args) =>
      invoke(event, async () => {
        if (args.length !== 2) {
          throw invalidCommand()
        }
        return store.setSampleExcluded(exactSampleId(args[0]), exactExcluded(args[1]))
      })
    )
    register(DEVELOPER_CHANNELS.captureFrame, (event, args) =>
      invoke(event, async (): Promise<DeveloperFrame> => {
        requireNoArguments(args)
        return store.captureFrame(() =>
          capturePrimaryPng(event, window, rendererDocumentUrl, () => disposed)
        )
      })
    )
    register(DEVELOPER_CHANNELS.previewParty, (event, args) =>
      invoke(event, async (): Promise<DeveloperPartyPreviewResponse> => {
        if (args.length > 1) {
          throw invalidCommand()
        }
        const kind = args.length === 0 ? 'hud' : exactCollectionKind(args[0])
        try {
          const settings = await store.getSettings()
          if (!settings.enabled) {
            throw new DeveloperStoreError(DEVELOPER_ERROR_CODES.DISABLED)
          }
          const frame = await (await getPartyCaptureModule()).capturePartyFrame(kind)
          return {
            frame: previewFrame(frame),
            previewError: null,
            collection: collectionSession.getStatus()
          }
        } catch (error) {
          const safeCode =
            error instanceof Error && PUBLIC_ERROR_CODES.has(error.message)
              ? error.message
              : DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE
          return {
            frame: null,
            previewError: safeCode,
            collection: collectionSession.getStatus()
          }
        }
      })
    )
    register(DEVELOPER_CHANNELS.setPartyCollectionSlots, (event, args) =>
      invoke(event, async () => {
        if (args.length < 1 || args.length > 2) {
          throw invalidCommand()
        }
        const slots = exactPartySlots(args[0])
        const kind = args.length === 1 ? 'hud' : exactCollectionKind(args[1])
        if (slots == null) {
          await collectionSession.stop()
          return collectionSession.getStatus()
        }
        return collectionSession.setSlots(slots, kind)
      })
    )

    window.on('closed', dispose)
    window.webContents.on('destroyed', dispose)
    window.webContents.on('did-start-navigation', onMainFrameNavigation)
    window.webContents.on('did-navigate', onMainFrameNavigated)
    window.webContents.on('did-fail-load', onLoadFailed)
    window.webContents.on('render-process-gone', onRendererGone)
  } catch (error) {
    dispose()
    throw sanitizedError(error)
  }

  return dispose
}

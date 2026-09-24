import { ipcMain, nativeImage, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import type { DeveloperFrame } from '../../preload/common/types/developer'
import { DEVELOPER_CHANNELS } from '../../preload/common/developer-channels'
import { createDeveloperStore, DeveloperStoreError } from './persistence'

const PUBLIC_ERROR_CODES = new Set([
  'DEVELOPER_NOT_ALLOWED',
  'DEVELOPER_INVALID_COMMAND',
  'DEVELOPER_DISABLED',
  'DEVELOPER_STORAGE_UNAVAILABLE',
  'DEVELOPER_SAMPLE_NOT_FOUND',
  'DEVELOPER_CAPTURE_UNAVAILABLE',
  'DEVELOPER_OPERATION_FAILED'
])

function invalidCommand(): Error {
  return new Error('DEVELOPER_INVALID_COMMAND')
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
  return new Error(isPublicCode ? message : 'DEVELOPER_OPERATION_FAILED')
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
    throw new DeveloperStoreError('DEVELOPER_NOT_ALLOWED')
  }
}

function rgbaToWindowsBitmap(rgba: Buffer, width: number, height: number): Buffer {
  if (rgba.length !== width * height * 4) {
    throw new DeveloperStoreError('DEVELOPER_CAPTURE_UNAVAILABLE')
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
      throw new DeveloperStoreError('DEVELOPER_CAPTURE_UNAVAILABLE')
    }
  } catch (error) {
    const wasAccessDenied =
      error instanceof DeveloperStoreError && error.code === 'DEVELOPER_NOT_ALLOWED'
    failureCode = wasAccessDenied ? 'DEVELOPER_NOT_ALLOWED' : 'DEVELOPER_CAPTURE_UNAVAILABLE'
  }

  if (hidWindow) {
    try {
      const isWindowAlive = !window.isDestroyed()
      if (isWindowAlive) {
        window.showInactive()
      }
    } catch {
      failureCode = 'DEVELOPER_CAPTURE_UNAVAILABLE'
    }
  }

  if (failureCode != null) {
    throw new DeveloperStoreError(failureCode)
  }
  if (png == null) {
    throw new DeveloperStoreError('DEVELOPER_CAPTURE_UNAVAILABLE')
  }
  return png
}

export function registerDeveloperWindow(
  window: BrowserWindow,
  rendererDocumentUrl: string,
  rootDir: string
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
  const registeredChannels: string[] = []

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
        return store.setEnabled(enabled)
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
    register(DEVELOPER_CHANNELS.captureFrame, (event, args) =>
      invoke(event, async (): Promise<DeveloperFrame> => {
        requireNoArguments(args)
        return store.captureFrame(() =>
          capturePrimaryPng(event, window, rendererDocumentUrl, () => disposed)
        )
      })
    )

    window.on('closed', dispose)
    window.webContents.on('destroyed', dispose)
  } catch (error) {
    dispose()
    throw sanitizedError(error)
  }

  return dispose
}

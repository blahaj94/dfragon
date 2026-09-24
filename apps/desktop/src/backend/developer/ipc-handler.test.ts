import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEVELOPER_CHANNELS } from '../../preload/common/developer-channels'
import { registerDeveloperWindow } from './ipc-handler'

const electron = vi.hoisted(() => ({ handle: vi.fn(), removeHandler: vi.fn() }))
vi.mock('electron', () => ({
  ipcMain: { handle: electron.handle, removeHandler: electron.removeHandler },
  nativeImage: {
    createFromBuffer: vi.fn(() => ({
      isEmpty: () => false,
      getSize: () => ({ width: 2, height: 1 })
    })),
    createFromBitmap: vi.fn(() => ({ toPNG: () => Buffer.alloc(0) }))
  }
}))

const rendererUrl = 'file:///developer-fixture/index.html'
const directories: string[] = []
type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

async function setup(): Promise<{
  handlers: Map<string, Handler>
  rootDir: string
  event: IpcMainInvokeEvent
  frame: { url: string; detached: boolean; isDestroyed: () => boolean }
  webContents: Record<string, unknown>
  window: Record<string, unknown>
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  dispose: () => void
}> {
  const rootDir = await mkdtemp(join(tmpdir(), 'dfragon-developer-ipc-'))
  directories.push(rootDir)
  const handlers = new Map<string, Handler>()
  electron.handle.mockImplementation((channel: string, handler: Handler) => {
    handlers.set(channel, handler)
  })
  electron.removeHandler.mockImplementation((channel: string) => handlers.delete(channel))

  const frame = { url: rendererUrl, detached: false, isDestroyed: () => false }
  const webContents = {
    mainFrame: frame,
    isDestroyed: () => false,
    on: vi.fn(),
    removeListener: vi.fn()
  }
  const window = {
    webContents,
    isDestroyed: () => false,
    isVisible: () => false,
    isMinimized: () => false,
    hide: vi.fn(),
    showInactive: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  }
  const dispose = registerDeveloperWindow(window as unknown as BrowserWindow, rendererUrl, rootDir)
  const event = { sender: webContents, senderFrame: frame } as unknown as IpcMainInvokeEvent
  const invoke = (channel: string, ...args: unknown[]): Promise<unknown> => {
    const handler = handlers.get(channel)
    if (handler == null) {
      throw new Error(`Missing developer handler: ${channel}`)
    }
    return Promise.resolve().then(() => handler(event, ...args))
  }
  return { handlers, rootDir, event, frame, webContents, window, invoke, dispose }
}

beforeEach(() => vi.clearAllMocks())
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

it('keeps settings accessible while disabled and gates collection commands in main', async () => {
  const fixture = await setup()

  expect(await fixture.invoke(DEVELOPER_CHANNELS.getSettings)).toEqual({ enabled: false })
  await expect(fixture.invoke(DEVELOPER_CHANNELS.listSamples)).rejects.toThrow('DEVELOPER_DISABLED')
  expect(await fixture.invoke(DEVELOPER_CHANNELS.setEnabled, false)).toEqual({ enabled: false })
  await expect(fixture.invoke(DEVELOPER_CHANNELS.captureFrame)).rejects.toThrow(
    'DEVELOPER_DISABLED'
  )
  expect(fixture.window.hide).not.toHaveBeenCalled()

  expect(await fixture.invoke(DEVELOPER_CHANNELS.setEnabled, true)).toEqual({ enabled: true })
  expect(await fixture.invoke(DEVELOPER_CHANNELS.listSamples)).toEqual([])
})

it('requires the registered webContents main frame and exact document URL', async () => {
  const fixture = await setup()
  const event = fixture.event as unknown as { sender: unknown; senderFrame: unknown }

  event.sender = {}
  await expect(fixture.invoke(DEVELOPER_CHANNELS.getSettings)).rejects.toThrow(
    'DEVELOPER_NOT_ALLOWED'
  )
  event.sender = fixture.webContents

  fixture.frame.url = 'about:blank'
  await expect(fixture.invoke(DEVELOPER_CHANNELS.setEnabled, true)).rejects.toThrow(
    'DEVELOPER_NOT_ALLOWED'
  )
  fixture.frame.url = rendererUrl
  event.senderFrame = {}
  await expect(fixture.invoke(DEVELOPER_CHANNELS.setEnabled, true)).rejects.toThrow(
    'DEVELOPER_NOT_ALLOWED'
  )
  event.senderFrame = fixture.frame
  expect(await fixture.invoke(DEVELOPER_CHANNELS.getSettings)).toEqual({ enabled: false })
})

it('rejects malformed IPC arguments and does not expose storage paths in errors', async () => {
  const fixture = await setup()

  await expect(fixture.invoke(DEVELOPER_CHANNELS.getSettings, 'extra')).rejects.toThrow(
    'DEVELOPER_INVALID_COMMAND'
  )
  await expect(fixture.invoke(DEVELOPER_CHANNELS.setEnabled, 'true')).rejects.toThrow(
    'DEVELOPER_INVALID_COMMAND'
  )
  await expect(fixture.invoke(DEVELOPER_CHANNELS.readImage, '../../settings.json')).rejects.toThrow(
    'DEVELOPER_INVALID_COMMAND'
  )

  const storageDirectory = join(fixture.rootDir, 'developer-mode')
  await mkdir(storageDirectory, { recursive: true })
  await writeFile(join(storageDirectory, 'settings.json'), '{"enabled":"true"}')
  const storageError = await fixture.invoke(DEVELOPER_CHANNELS.setEnabled, true).then(
    () => null,
    (error: unknown) => error
  )
  expect(storageError).toMatchObject({ message: 'DEVELOPER_STORAGE_UNAVAILABLE' })
  expect(String(storageError)).not.toContain(fixture.rootDir)

  fixture.dispose()
  expect(fixture.handlers.size).toBe(0)
  expect(electron.removeHandler).toHaveBeenCalledTimes(7)
})

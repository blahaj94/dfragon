import { EventEmitter } from 'node:events'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { registerVersionsWindow } from './ipc-handler'
import type { BuildVersions } from '../../preload/common/types/build-versions'

const mocks = vi.hoisted(() => {
  const add = vi.fn()
  const remove = vi.fn()
  const read = vi.fn()

  return { add, remove, read }
})
vi.mock('../ipc', () => ({ addHandler: mocks.add }))
vi.mock('electron', () => ({ ipcMain: { removeHandler: mocks.remove } }))
vi.mock('./http', () => ({ createServerVersionReader: () => mocks.read }))

const documentUrl = 'file:///synthetic/index.html'
const servers: BuildVersions['servers'] = {
  api: { status: 'available', commit: 'a'.repeat(40) },
  accounts: { status: 'unsupported' },
  ocr: { status: 'unavailable' }
}
let dispose: () => void

beforeEach(() => {
  vi.clearAllMocks()
  mocks.read.mockResolvedValue(servers)
})
afterEach(() => dispose?.())

type Frame = { url: string; detached: boolean; isDestroyed: ReturnType<typeof vi.fn> }
type Contents = EventEmitter & { mainFrame: Frame; isDestroyed: ReturnType<typeof vi.fn> }
type WindowFixture = EventEmitter & { webContents: Contents; isDestroyed: ReturnType<typeof vi.fn> }

function fixture(): {
  window: WindowFixture
  contents: Contents
  frame: Frame
  event: IpcMainInvokeEvent
  invoke: (event: unknown, ...args: unknown[]) => Promise<BuildVersions>
} {
  const frame = { url: documentUrl, detached: false, isDestroyed: vi.fn(() => false) }
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: frame,
    isDestroyed: vi.fn(() => false)
  })
  const window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: vi.fn(() => false)
  })
  dispose = registerVersionsWindow({
    window: window as unknown as BrowserWindow,
    documentUrl,
    desktop: () => {
      const commit = 'b'.repeat(40)

      return { version: '2.3.4', commit, dirty: false }
    },
    apiOrigin: 'https://api.example.test',
    accountsOrigin: 'https://accounts.example.test'
  })
  const invoke = mocks.add.mock.calls.at(-1)![1] as (
    event: unknown,
    ...args: unknown[]
  ) => Promise<BuildVersions>
  const event = { sender: contents, senderFrame: frame } as unknown as IpcMainInvokeEvent

  return { window, contents, frame, event, invoke }
}

it('returns local package/source identity plus independently read server versions', async () => {
  const f = fixture()
  expect(await f.invoke(f.event)).toEqual({
    desktop: { version: '2.3.4', commit: 'b'.repeat(40), dirty: false },
    servers
  })
  expect(mocks.add.mock.calls[0][0]).toBe('getBuildVersions')
})

it('완료 후 새로고침은 이전 응답을 재사용하지 않고 서버의 현재 커밋을 조회한다', async () => {
  const updatedServers: BuildVersions['servers'] = {
    api: { status: 'available', commit: 'c'.repeat(40) },
    accounts: { status: 'available', commit: 'd'.repeat(40) },
    ocr: { status: 'unsupported' }
  }
  mocks.read.mockResolvedValueOnce(servers).mockResolvedValueOnce(updatedServers)
  const f = fixture()

  expect((await f.invoke(f.event)).servers).toEqual(servers)
  expect(await f.invoke(f.event)).toEqual({
    desktop: { version: '2.3.4', commit: 'b'.repeat(40), dirty: false },
    servers: updatedServers
  })
  expect(mocks.read).toHaveBeenCalledTimes(2)
})

it.each([
  'sender',
  'subframe',
  'document',
  'detached',
  'destroyedFrame',
  'destroyedWindow',
  'destroyedContents'
])('rejects an untrusted %s before any network request', async (kind) => {
  const f = fixture()
  const event = { sender: f.contents, senderFrame: f.frame } as {
    sender: unknown
    senderFrame: unknown
  }
  if (kind === 'sender') {
    event.sender = {}
  }

  if (kind === 'subframe') {
    event.senderFrame = {}
  }

  if (kind === 'document') {
    f.frame.url = `${documentUrl}?other`
  }

  if (kind === 'detached') {
    f.frame.detached = true
  }

  if (kind === 'destroyedFrame') {
    f.frame.isDestroyed.mockReturnValue(true)
  }

  if (kind === 'destroyedWindow') {
    f.window.isDestroyed.mockReturnValue(true)
  }

  if (kind === 'destroyedContents') {
    f.contents.isDestroyed.mockReturnValue(true)
  }
  await expect(f.invoke(event)).rejects.toThrow('VERSION_NOT_ALLOWED')
  expect(mocks.read).not.toHaveBeenCalled()
})

it('rejects extra arguments, including undefined and an arbitrary URL', async () => {
  const f = fixture()
  await expect(f.invoke(f.event, undefined)).rejects.toThrow('INVALID_VERSION_COMMAND')
  await expect(f.invoke(f.event, 'https://untrusted.example')).rejects.toThrow(
    'INVALID_VERSION_COMMAND'
  )
  expect(mocks.read).not.toHaveBeenCalled()
})

it('coalesces concurrent requests but rejects a completion from the previous document', async () => {
  let finish!: (value: BuildVersions['servers']) => void
  mocks.read.mockReturnValue(
    new Promise<BuildVersions['servers']>((resolve) => {
      finish = resolve
    })
  )
  const f = fixture()
  const first = f.invoke(f.event)
  const second = f.invoke(f.event)
  const failures = Promise.all([
    expect(first).rejects.toThrow('VERSION_NOT_ALLOWED'),
    expect(second).rejects.toThrow('VERSION_NOT_ALLOWED')
  ])
  f.contents.emit('did-start-navigation', {}, documentUrl, false, true)
  finish(servers)
  await failures
  expect(mocks.read).toHaveBeenCalledOnce()
})

it('removes the handler and its lifetime listeners on close', async () => {
  const f = fixture()
  f.window.emit('closed')
  dispose()
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith('getBuildVersions')
  expect(f.contents.listenerCount('did-start-navigation')).toBe(0)
  await expect(f.invoke(f.event)).rejects.toThrow('VERSION_NOT_ALLOWED')
})

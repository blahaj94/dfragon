import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { registerClipboardWindow } from './ipc-handler'
import { CLIPBOARD_CHANNELS } from '../../preload/common/types/clipboard'

const mocks = vi.hoisted(() => ({ handle: vi.fn(), remove: vi.fn(), writeText: vi.fn() }))
vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle, removeHandler: mocks.remove },
  clipboard: { writeText: mocks.writeText }
}))

const documentUrl = 'file:///synthetic/index.html'
let dispose: (() => void) | undefined
beforeEach(() => {
  vi.clearAllMocks()
  dispose = undefined
})
afterEach(() => dispose?.())

function fixture() {
  const frame = { url: documentUrl, detached: false, isDestroyed: vi.fn(() => false) }
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: frame,
    isDestroyed: vi.fn(() => false)
  })
  const window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: vi.fn(() => false)
  })
  const event = { sender: contents, senderFrame: frame }
  dispose = registerClipboardWindow({ window: window as unknown as BrowserWindow, documentUrl })
  const writeText = mocks.handle.mock.calls.find(
    ([channel]) => channel === CLIPBOARD_CHANNELS.writeText
  )![1] as (event: unknown, ...args: unknown[]) => Promise<void>

  return { window, contents, frame, event, writeText }
}

it('메인 창 문서가 보낸 글자를 그대로 클립보드에 쓴다', async () => {
  const f = fixture()
  const text = '[퍼리조아, 시로코, 검은전투늑대], [퍼리조이, , ], [], []'

  await expect(f.writeText(f.event, text)).resolves.toBeUndefined()
  expect(mocks.writeText).toHaveBeenCalledExactlyOnceWith(text)
})

it.each([
  'sender',
  'subframe',
  'nullFrame',
  'document',
  'detached',
  'destroyedFrame',
  'destroyedWindow',
  'destroyedContents'
])('%s에서 온 쓰기는 클립보드를 건드리기 전에 거부한다', async (kind) => {
  const f = fixture()
  const event: { sender: unknown; senderFrame: unknown } = { ...f.event }
  if (kind === 'sender') {
    event.sender = {}
  }

  if (kind === 'subframe') {
    event.senderFrame = {}
  }

  if (kind === 'nullFrame') {
    event.senderFrame = null
  }

  if (kind === 'document') {
    f.frame.url = `${documentUrl}?unexpected`
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
  await expect(f.writeText(event, '[]')).rejects.toThrow('CLIPBOARD_NOT_ALLOWED')
  expect(mocks.writeText).not.toHaveBeenCalled()
})

it.each([
  ['글자가 아닌 값', [42]],
  ['인자 없음', []],
  ['인자 둘', ['[]', '[]']],
  ['상한을 넘는 글자', ['a'.repeat(4097)]]
])('%s은 클립보드를 건드리지 않고 거부한다', async (_name, args) => {
  const f = fixture()

  await expect(f.writeText(f.event, ...args)).rejects.toThrow('INVALID_CLIPBOARD_COMMAND')
  expect(mocks.writeText).not.toHaveBeenCalled()
})

it('상한 길이의 글자는 받는다', async () => {
  const f = fixture()

  await f.writeText(f.event, 'a'.repeat(4096))
  expect(mocks.writeText).toHaveBeenCalledOnce()
})

it.each(['closed', 'destroyed', 'dispose'] as const)(
  '%s 뒤 handler와 listener를 제거하고 반복 dispose도 안전하다',
  async (kind) => {
    const f = fixture()
    if (kind === 'closed') {
      f.window.emit('closed')
    }

    if (kind === 'destroyed') {
      f.contents.emit('destroyed')
    }

    if (kind === 'dispose') {
      dispose?.()
    }

    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(CLIPBOARD_CHANNELS.writeText)
    expect(f.window.listenerCount('closed')).toBe(0)
    expect(f.contents.listenerCount('destroyed')).toBe(0)
    dispose?.()
    expect(mocks.remove).toHaveBeenCalledOnce()
    await expect(f.writeText(f.event, '[]')).rejects.toThrow('CLIPBOARD_NOT_ALLOWED')
    expect(mocks.writeText).not.toHaveBeenCalled()
  }
)

import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import { afterEach, beforeEach, expect, it, vi, type Mock } from 'vitest'
import { registerDiagnosticsWindow } from './ipc-handler'
import { createDiagnosticLog, type DiagnosticLog } from './log'
import { DIAGNOSTIC_CHANNELS } from '../../preload/common/types/diagnostics'

const mocks = vi.hoisted(() => ({ handle: vi.fn(), remove: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle: mocks.handle, removeHandler: mocks.remove } }))

const documentUrl = 'file:///synthetic/index.html'
let dispose: (() => void) | undefined
beforeEach(() => vi.clearAllMocks())
afterEach(() => dispose?.())

type FrameFixture = { url: string; detached: boolean; isDestroyed: Mock<() => boolean> }
type ContentsFixture = EventEmitter & {
  mainFrame: FrameFixture
  isDestroyed: Mock<() => boolean>
  send: Mock
  isDevToolsOpened: Mock<() => boolean>
  openDevTools: Mock
  closeDevTools: Mock
}
type WindowFixture = EventEmitter & {
  webContents: ContentsFixture
  isDestroyed: Mock<() => boolean>
}

function fixture(): {
  window: WindowFixture
  contents: ContentsFixture
  frame: FrameFixture
  event: { sender: ContentsFixture; senderFrame: FrameFixture }
  log: DiagnosticLog
  history: (event: unknown, ...args: unknown[]) => Promise<unknown>
  report: (event: unknown, ...args: unknown[]) => Promise<void>
} {
  const frame = { url: documentUrl, detached: false, isDestroyed: vi.fn(() => false) }
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: frame,
    isDestroyed: vi.fn(() => false),
    send: vi.fn(),
    isDevToolsOpened: vi.fn(() => false),
    openDevTools: vi.fn(),
    closeDevTools: vi.fn()
  })
  const window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: vi.fn(() => false)
  })
  const log = createDiagnosticLog()
  dispose = registerDiagnosticsWindow({
    window: window as unknown as BrowserWindow,
    documentUrl,
    log
  })
  const event = { sender: contents, senderFrame: frame }
  const history = mocks.handle.mock.calls.find(
    ([channel]) => channel === DIAGNOSTIC_CHANNELS.history
  )![1] as (event: unknown, ...args: unknown[]) => Promise<unknown>
  const report = mocks.handle.mock.calls.find(
    ([channel]) => channel === DIAGNOSTIC_CHANNELS.report
  )![1] as (event: unknown, ...args: unknown[]) => Promise<void>

  return { window, contents, frame, event, log, history, report }
}

it('신뢰한 메인 화면은 과거 기록과 실시간 진단 코드를 받는다', async () => {
  const f = fixture()
  f.log.report('CAPTURE_COVERED')
  await f.report(f.event, 'OCR_FAILED')
  expect(await f.history(f.event)).toEqual([
    { sequence: 1, timestamp: expect.any(Number), code: 'CAPTURE_COVERED' },
    { sequence: 2, timestamp: expect.any(Number), code: 'OCR_FAILED' }
  ])
  expect(f.contents.send).toHaveBeenLastCalledWith(DIAGNOSTIC_CHANNELS.entry, {
    sequence: 2,
    timestamp: expect.any(Number),
    code: 'OCR_FAILED'
  })
})

it.each([
  'sender',
  'subframe',
  'document',
  'detached',
  'destroyedFrame',
  'destroyedWindow',
  'destroyedContents'
])('%s에서 온 진단 조회와 보고를 거부한다', async (kind) => {
  const f = fixture()
  const event: { sender: unknown; senderFrame: unknown } = { ...f.event }
  if (kind === 'sender') {
    event.sender = {}
  }

  if (kind === 'subframe') {
    event.senderFrame = {}
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
  await expect(f.history(event)).rejects.toThrow('DIAGNOSTICS_NOT_ALLOWED')
  await expect(f.report(event, 'OCR_FAILED')).rejects.toThrow('DIAGNOSTICS_NOT_ALLOWED')
  expect(f.log.history()).toHaveLength(0)
})

it('원문 오류나 메인 전용 코드, 추가 인자는 기록하지 않는다', async () => {
  const f = fixture()
  await expect(f.history(f.event, undefined)).rejects.toThrow('INVALID_DIAGNOSTIC_COMMAND')
  for (const args of [
    [],
    ['MAIN_PROCESS_FAILED'],
    ['OCR_FAILED', 'synthetic private text'],
    [new Error('synthetic private text')]
  ]) {
    await expect(f.report(f.event, ...args)).rejects.toThrow('INVALID_DIAGNOSTIC_COMMAND')
  }
  expect(f.log.history()).toHaveLength(0)
})

it('등록한 문서를 벗어나거나 창을 닫으면 진단을 보내지 않고 자원을 정리한다', async () => {
  const f = fixture()
  f.frame.url = 'https://synthetic.invalid/'
  f.log.report('OCR_FAILED')
  expect(f.contents.send).not.toHaveBeenCalled()
  f.window.emit('closed')
  dispose?.()
  f.log.report('UPLOAD_FAILED')
  expect(f.contents.send).not.toHaveBeenCalled()
  expect(mocks.remove.mock.calls).toEqual([
    [DIAGNOSTIC_CHANNELS.history],
    [DIAGNOSTIC_CHANNELS.report]
  ])
  expect(f.contents.listenerCount('before-input-event')).toBe(0)
  expect(f.contents.listenerCount('render-process-gone')).toBe(0)
  await expect(f.history(f.event)).rejects.toThrow('DIAGNOSTICS_NOT_ALLOWED')
})

it('Ctrl+Shift+I는 신뢰한 화면에서만 기본 DevTools를 열고 닫는다', () => {
  const f = fixture()
  const event = { preventDefault: vi.fn() }
  const input = {
    type: 'keyDown',
    key: 'I',
    control: true,
    shift: true,
    alt: false,
    meta: false,
    isAutoRepeat: false
  }
  f.contents.emit('before-input-event', event, input)
  expect(f.contents.openDevTools).toHaveBeenCalledExactlyOnceWith({ mode: 'detach' })
  f.contents.isDevToolsOpened.mockReturnValue(true)
  f.contents.emit('before-input-event', event, input)
  expect(f.contents.closeDevTools).toHaveBeenCalledOnce()
  f.contents.emit('before-input-event', event, { ...input, isAutoRepeat: true })
  f.contents.emit('before-input-event', event, { ...input, shift: false })
  f.frame.url = 'https://synthetic.invalid/'
  f.contents.emit('before-input-event', event, input)
  expect(event.preventDefault).toHaveBeenCalledTimes(2)
})

it('화면 프로세스 종료는 원래 이벤트의 세부정보 없이 기록한다', () => {
  const f = fixture()
  f.contents.emit('render-process-gone', {}, { reason: 'synthetic private data' })
  expect(f.log.history()).toEqual([
    { sequence: 1, timestamp: expect.any(Number), code: 'RENDERER_PROCESS_GONE' }
  ])
})

import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { registerTodayGradeWindow } from './ipc-handler'
import { TODAY_GRADE_CHANNELS, type TodayGrade } from '../../preload/common/types/today-grade'

const mocks = vi.hoisted(() => ({ handle: vi.fn(), remove: vi.fn() }))
vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle, removeHandler: mocks.remove }
}))

const documentUrl = 'file:///synthetic/index.html'
const grade = { percent: 85, expiresAt: '2026-10-30T15:00:00.000Z' }
let dispose: (() => void) | undefined
beforeEach(() => {
  vi.clearAllMocks()
  dispose = undefined
})
afterEach(() => dispose?.())

function fixture(readGrade: () => Promise<TodayGrade> = async () => grade) {
  const frame = { url: documentUrl, detached: false, isDestroyed: vi.fn(() => false) }
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: frame,
    isDestroyed: vi.fn(() => false)
  })
  const window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: vi.fn(() => false)
  })
  const read = vi.fn(readGrade)
  dispose = registerTodayGradeWindow({
    window: window as unknown as BrowserWindow,
    documentUrl,
    readGrade: read
  })
  const handler = mocks.handle.mock.calls.find(
    ([channel]) => channel === TODAY_GRADE_CHANNELS.read
  )![1] as (event: unknown, ...args: unknown[]) => Promise<TodayGrade>

  return { window, contents, frame, read, handler, event: { sender: contents, senderFrame: frame } }
}

it('메인 창 문서의 요청에 API에서 받은 오늘의 등급을 돌려준다', async () => {
  const f = fixture()

  await expect(f.handler(f.event)).resolves.toEqual(grade)
  expect(f.read).toHaveBeenCalledOnce()
})

it.each(['sender', 'subframe', 'document'])(
  '%s가 다른 요청은 API를 부르기 전에 거부한다',
  async (kind) => {
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

    await expect(f.handler(event)).rejects.toThrow('TODAY_GRADE_NOT_ALLOWED')
    expect(f.read).not.toHaveBeenCalled()
  }
)

it('인자가 있는 요청은 거부한다', async () => {
  const f = fixture()

  await expect(f.handler(f.event, 'extra')).rejects.toThrow('INVALID_TODAY_GRADE_COMMAND')
  expect(f.read).not.toHaveBeenCalled()
})

it('API 조회 실패는 원문 대신 TODAY_GRADE_UNAVAILABLE로 알린다', async () => {
  const f = fixture(async () => {
    throw new Error('https://api.synthetic.invalid/items/today-grade 504')
  })

  await expect(f.handler(f.event)).rejects.toThrow(/^TODAY_GRADE_UNAVAILABLE$/)
})

it('창이 닫히면 handler를 지운다', () => {
  const f = fixture()
  f.window.emit('closed')

  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(TODAY_GRADE_CHANNELS.read)
})

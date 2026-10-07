import { EventEmitter } from 'node:events'
import { beforeEach, expect, it, vi } from 'vitest'

const renderer = vi.hoisted(() => ({ on: vi.fn(), removeListener: vi.fn() }))
vi.mock('electron', () => ({ ipcRenderer: renderer }))
import { onDesktopShortcut } from './desktop-shortcut'

beforeEach(() => vi.clearAllMocks())

it('허용된 단축키만 전달하고 구독 해제 시 자기 listener만 제거한다', () => {
  const events = new EventEmitter()
  renderer.on.mockImplementation(events.on.bind(events))
  renderer.removeListener.mockImplementation(events.removeListener.bind(events))
  const first = vi.fn()
  const second = vi.fn()
  const unsubscribe = onDesktopShortcut(first)
  onDesktopShortcut(second)
  events.emit('desktopShortcut', {}, 'restart-search')
  unsubscribe()
  events.emit('desktopShortcut', {}, 'upload-capture')
  events.emit('desktopShortcut', {}, { action: 'restart-search' })
  events.emit('desktopShortcut', {}, 'unknown')
  expect(first.mock.calls).toEqual([['restart-search']])
  expect(second.mock.calls).toEqual([['restart-search'], ['upload-capture']])
})

import type { BrowserWindow } from 'electron'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const windows = vi.hoisted(() => [] as Pick<BrowserWindow, 'isDestroyed' | 'setIcon'>[])
vi.mock('electron', () => ({
  app: { dock: undefined },
  BrowserWindow: { getAllWindows: () => windows }
}))

import { registerTimeOfDayIcon } from './register'

beforeEach(() => {
  vi.useFakeTimers()
  windows.length = 0
})

afterEach(() => {
  vi.useRealTimers()
})

it('시간대가 바뀌면 열린 창 아이콘을 새 시간대 그림으로 바꾸고, 정리 뒤에는 바꾸지 않는다', () => {
  vi.setSystemTime(new Date(2026, 9, 30, 11, 59, 30))
  const window = { isDestroyed: () => false, setIcon: vi.fn() }
  windows.push(window)

  const dispose = registerTimeOfDayIcon()
  expect(window.setIcon).toHaveBeenLastCalledWith(expect.stringMatching(/time-of-day\/day\.png$/))

  vi.advanceTimersByTime(60 * 1000)
  expect(window.setIcon).toHaveBeenLastCalledWith(
    expect.stringMatching(/time-of-day\/afternoon\.png$/)
  )

  dispose()
  window.setIcon.mockClear()
  vi.setSystemTime(new Date(2026, 9, 30, 18, 0, 0))
  vi.advanceTimersByTime(60 * 1000)
  expect(window.setIcon).not.toHaveBeenCalled()
})

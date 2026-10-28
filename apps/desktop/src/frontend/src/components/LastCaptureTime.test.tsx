// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LastCaptureTime } from './LastCaptureTime'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers({ now: new Date('2026-10-18T12:00:00Z') })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function render(at: number | null): Promise<void> {
  await act(async () => root.render(<LastCaptureTime at={at} />))
}

function lastCapture(): string | null {
  const label = [...container.querySelectorAll('span')].find(
    (span) => span.textContent === '마지막 캡처'
  )!

  return label.nextElementSibling!.textContent
}

it('마지막 캡처 시각이 없으면 -이고, 있으면 상대 시간을 표시 값이 바뀔 때마다 고친다', async () => {
  await render(null)
  expect(lastCapture()).toBe('-')
  expect(container.querySelector('time')).toBeNull()
  const at = Date.now() - 12_000
  await render(at)
  expect(lastCapture()).toBe('12초 전')
  expect(container.querySelector('time')?.getAttribute('dateTime')).toBe(new Date(at).toISOString())
  await act(async () => vi.advanceTimersByTime(1_000))
  expect(lastCapture()).toBe('13초 전')
  for (let second = 14; second <= 60; second++) {
    await act(async () => vi.advanceTimersByTime(1_000))
  }
  expect(lastCapture()).toBe('1분 전')
  expect(vi.getTimerCount()).toBe(1)
  const nextTimer = vi.spyOn(window, 'setTimeout')
  await act(async () => vi.advanceTimersByTime(59_000))
  expect(lastCapture()).toBe('1분 전')
  expect(nextTimer).not.toHaveBeenCalled()
  await act(async () => vi.advanceTimersByTime(1_000))
  expect(lastCapture()).toBe('2분 전')
  expect(nextTimer).toHaveBeenCalledOnce()
  expect(nextTimer.mock.lastCall?.[1]).toBe(60_000)
  nextTimer.mockRestore()
  await render(null)
  expect(lastCapture()).toBe('-')
  expect(vi.getTimerCount()).toBe(0)
})

it('새 회차가 끝나면 새 완료 시각부터 다시 센다', async () => {
  await render(Date.now() - 5 * 60_000)
  expect(lastCapture()).toBe('5분 전')
  await render(Date.now())
  expect(lastCapture()).toBe('0초 전')
  vi.setSystemTime(Date.now() + 30_000)
  await render(Date.now() - 12_000)
  expect(lastCapture()).toBe('12초 전')
})

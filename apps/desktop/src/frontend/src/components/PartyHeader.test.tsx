// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PartyHeader } from './PartyHeader'

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

async function render(props: Partial<ComponentProps<typeof PartyHeader>> = {}): Promise<void> {
  await act(async () =>
    root.render(
      <PartyHeader
        status="조회 완료"
        filledCount={2}
        lastCapturedAt={null}
        canCapture
        onCapture={() => {}}
        collapsed={false}
        onToggleCollapsed={() => {}}
        controls="party-cards"
        {...props}
      />
    )
  )
}

function lastCapture(): string | null {
  const label = [...container.querySelectorAll('span')].find(
    (span) => span.textContent === '마지막 캡처'
  )!

  return label.nextElementSibling!.textContent
}

function captureButton(): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>('[aria-label="파티 캡처, 단축키 Alt R"]')!
}

it('제목, 채운 자리 수, 진행 문구 뒤에 접기, 마지막 캡처, 스냅샷, 캡처 버튼 순서로 둔다', async () => {
  await render()
  expect(container.querySelector('h1')?.textContent).toBe('파티')
  expect(container.textContent).toContain('2/4')
  expect(container.querySelector('[role="status"]')?.textContent).toBe('조회 완료')
  const buttons = [...container.querySelectorAll('button')].map((button) =>
    button.getAttribute('aria-label')
  )
  expect(buttons).toEqual(['카드 접기', '파티 모험단 순번 스냅샷', '파티 캡처, 단축키 Alt R'])
  const fold = container.querySelector('[aria-label="카드 접기"]')!
  const time = [...container.querySelectorAll('span')].find(
    (span) => span.textContent === '마지막 캡처'
  )!
  const snapshot = container.querySelector('[aria-label="파티 모험단 순번 스냅샷"]')!
  for (const [before, after] of [
    [fold, time],
    [time, snapshot],
    [snapshot, captureButton()]
  ]) {
    expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  }
  expect(fold.getAttribute('aria-controls')).toBe('party-cards')
  expect(
    container.querySelector<HTMLButtonElement>('[aria-label="파티 모험단 순번 스냅샷"]')!.disabled
  ).toBe(true)
})

it('캡처 버튼은 누를 수 있을 때만 회차 시작을 요청한다', async () => {
  const onCapture = vi.fn()
  await render({ onCapture, canCapture: false })
  expect(captureButton().disabled).toBe(true)
  await act(async () => captureButton().click())
  expect(onCapture).not.toHaveBeenCalled()
  await render({ onCapture, canCapture: true })
  await act(async () => captureButton().click())
  expect(onCapture).toHaveBeenCalledOnce()
})

it('마지막 캡처 시각이 없으면 -이고, 있으면 상대 시간을 표시 값이 바뀔 때마다 고친다', async () => {
  await render()
  expect(lastCapture()).toBe('-')
  expect(container.querySelector('time')).toBeNull()
  const at = Date.now() - 12_000
  await render({ lastCapturedAt: at })
  expect(lastCapture()).toBe('12초 전')
  expect(container.querySelector('time')?.getAttribute('dateTime')).toBe(new Date(at).toISOString())
  await act(async () => vi.advanceTimersByTime(1_000))
  expect(lastCapture()).toBe('13초 전')
  // 초 단위 동안은 다시 그린 뒤 다음 타이머를 걸므로 1초씩 넘긴다.
  for (let second = 14; second <= 60; second++) {
    await act(async () => vi.advanceTimersByTime(1_000))
  }
  expect(lastCapture()).toBe('1분 전')
  // 분 단위 동안은 1초마다 다시 그리지 않고 다음 분이 될 때 한 번 다시 그린다.
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
  await render({ lastCapturedAt: null })
  expect(lastCapture()).toBe('-')
  expect(vi.getTimerCount()).toBe(0)
})

it('새 회차가 끝나면 새 완료 시각부터 다시 센다', async () => {
  await render({ lastCapturedAt: Date.now() - 5 * 60_000 })
  expect(lastCapture()).toBe('5분 전')
  await render({ lastCapturedAt: Date.now() })
  expect(lastCapture()).toBe('0초 전')
  // 타이머가 돌기 전에 시계가 흐른 뒤 받은 완료 시각도 그 순간의 경과 시간으로 바로 보인다.
  vi.setSystemTime(Date.now() + 30_000)
  await render({ lastCapturedAt: Date.now() - 12_000 })
  expect(lastCapture()).toBe('12초 전')
})

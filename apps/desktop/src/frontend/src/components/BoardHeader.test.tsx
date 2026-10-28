// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BoardHeader } from './BoardHeader'

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

type Props = ComponentProps<typeof BoardHeader>
type RenderProps = Partial<Omit<Props, 'capture' | 'snapshot'>> & {
  capture?: Partial<Props['capture']>
  snapshot?: Partial<Props['snapshot']>
}

async function render({ capture, snapshot, ...props }: RenderProps = {}): Promise<void> {
  await act(async () =>
    root.render(
      <BoardHeader
        target="파티"
        filledCount={2}
        notice=""
        {...props}
        capture={{ lastCompletedAt: null, canStartCapture: true, startRound: () => {}, ...capture }}
        snapshot={{ active: false, round: null, take: () => {}, clear: () => {}, ...snapshot }}
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

it('제목, 인원수 뒤에 마지막 캡처, 스냅샷, 캡처 버튼 순서로 두고 카드 접기 버튼은 없다', async () => {
  await render()
  const heading = container.querySelector('h1')!
  expect(heading.textContent).toBe('파티')
  expect(heading.nextElementSibling?.textContent).toBe('2/4')
  const buttons = [...container.querySelectorAll('button')].map((button) =>
    button.getAttribute('aria-label')
  )
  expect(buttons).toEqual(['파티 모험단 순번 스냅샷', '파티 캡처, 단축키 Alt R'])
  expect(
    container.querySelector('[aria-label$="카드 접기"], [aria-label$="카드 펼치기"]')
  ).toBeNull()
  const time = [...container.querySelectorAll('span')].find(
    (span) => span.textContent === '마지막 캡처'
  )!
  const snapshot = container.querySelector('[aria-label="파티 모험단 순번 스냅샷"]')!
  for (const [before, after] of [
    [heading, time],
    [time, snapshot],
    [snapshot, captureButton()]
  ]) {
    expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  }
})

it('스냅샷 버튼은 켜짐 상태를 aria-pressed로 전하고 이름은 켜고 꺼도 같다', async () => {
  await render({ snapshot: { active: false } })
  const button = container.querySelector<HTMLButtonElement>(
    '[aria-label="파티 모험단 순번 스냅샷"]'
  )!
  expect(button.getAttribute('aria-pressed')).toBe('false')
  await render({ snapshot: { active: true } })
  expect(button.getAttribute('aria-pressed')).toBe('true')
  expect(button.getAttribute('aria-label')).toBe('파티 모험단 순번 스냅샷')
})

it('인원수 바로 뒤에 스냅샷 회차 번호를 보이고 스냅샷이 없으면 숨긴다', async () => {
  await render({ snapshot: { active: false, round: null } })
  expect(container.querySelector('[aria-label$="번째 파티"]')).toBeNull()

  await render({ snapshot: { active: true, round: 2 } })
  const round = container.querySelector('[aria-label="2번째 파티"]')!
  expect(round.textContent).toBe('#2')
  expect(round.previousElementSibling?.textContent).toContain('2/4')
})

it('공대 헤더는 제목, 전체 12자리, 회차 번호와 스냅샷, 캡처 버튼 이름을 공대로 둔다', async () => {
  await render({ target: '공대', snapshot: { active: true, round: 3 } })
  expect(container.querySelector('h1')?.textContent).toBe('공대')
  const round = container.querySelector('[aria-label="3번째 공대"]')!
  expect(round.textContent).toBe('#3')
  expect(round.previousElementSibling?.textContent).toBe('2/12')
  const buttons = [...container.querySelectorAll('button')].map((button) =>
    button.getAttribute('aria-label')
  )
  expect(buttons).toEqual(['공대 모험단 순번 스냅샷', '공대 캡처, 단축키 Alt R'])
})

it('꺼진 스냅샷 버튼을 누르면 스냅샷을 켠다', async () => {
  const take = vi.fn()
  const clear = vi.fn()
  await render({ snapshot: { active: false, take, clear } })
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="파티 모험단 순번 스냅샷"]')!.click()
  )
  expect(take).toHaveBeenCalledOnce()
  expect(clear).not.toHaveBeenCalled()
})

it('화면이 넘긴 안내만 status 영역에 보이고 없으면 영역을 비워 둔다', async () => {
  await render()
  const status = container.querySelector('[role="status"]')!
  expect(status.textContent).toBe('')
  await render({ notice: '검색 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.' })
  expect(container.querySelector('[role="status"]')).toBe(status)
  expect(status.textContent).toBe('검색 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.')
  expect(status.getAttribute('title')).toBe(
    '검색 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
  )
})

it('캡처 버튼은 누를 수 있을 때만 회차 시작을 요청한다', async () => {
  const startRound = vi.fn()
  await render({ capture: { startRound, canStartCapture: false } })
  expect(captureButton().disabled).toBe(true)
  await act(async () => captureButton().click())
  expect(startRound).not.toHaveBeenCalled()
  await render({ capture: { startRound, canStartCapture: true } })
  await act(async () => captureButton().click())
  expect(startRound).toHaveBeenCalledOnce()
})

it('마지막 캡처 시각이 없으면 -이고, 있으면 상대 시간을 표시 값이 바뀔 때마다 고친다', async () => {
  await render()
  expect(lastCapture()).toBe('-')
  expect(container.querySelector('time')).toBeNull()
  const at = Date.now() - 12_000
  await render({ capture: { lastCompletedAt: at } })
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
  await render({ capture: { lastCompletedAt: null } })
  expect(lastCapture()).toBe('-')
  expect(vi.getTimerCount()).toBe(0)
})

it('새 회차가 끝나면 새 완료 시각부터 다시 센다', async () => {
  await render({ capture: { lastCompletedAt: Date.now() - 5 * 60_000 } })
  expect(lastCapture()).toBe('5분 전')
  await render({ capture: { lastCompletedAt: Date.now() } })
  expect(lastCapture()).toBe('0초 전')
  vi.setSystemTime(Date.now() + 30_000)
  await render({ capture: { lastCompletedAt: Date.now() - 12_000 } })
  expect(lastCapture()).toBe('12초 전')
})

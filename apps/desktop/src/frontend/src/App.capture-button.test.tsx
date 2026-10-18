// @vitest-environment jsdom
import { act } from 'react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import {
  createRendererFixture,
  authSnapshot,
  media
} from './testing/fixtures/search-renderer-test-fixture'
import App from './App'
import { ColorThemeProvider } from './components/ColorThemeProvider'

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }))
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {
        return
      }
      unobserve(): void {
        return
      }
      disconnect(): void {
        return
      }
    }
  )
})
afterEach(() => vi.unstubAllGlobals())

type Fixture = ReturnType<typeof createRendererFixture>
type Trigger = 'Alt+R' | '캡처 버튼'

const triggers: Trigger[] = ['Alt+R', '캡처 버튼']

function captureButton(): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(
    'button[aria-label="파티 캡처, 단축키 Alt R"]'
  )
  expect(button).not.toBeNull()

  return button!
}

// Alt+R은 main이 보낸 단축키 이벤트로, 캡처 버튼은 화면 클릭으로 회차를 요청한다. 비활성 버튼의
// click()은 native button처럼 아무것도 실행하지 않는다.
async function press(f: Fixture, trigger: Trigger): Promise<void> {
  if (trigger === 'Alt+R') {
    await f.restart()

    return
  }
  await act(async () => captureButton().click())
}

function partyStatus(): string | null {
  const heading = [...document.querySelectorAll('h1')].find((h1) => h1.textContent === '파티')!

  return heading.parentElement!.querySelector('[role="status"]')!.textContent
}

function lastCapture(): string | null {
  const label = [...document.querySelectorAll('span')].find(
    (span) => span.textContent === '마지막 캡처'
  )!

  return label.nextElementSibling!.textContent
}

// 상단 바의 상태 칩으로 캡처 대화상자를 열고 창 목록에서 창을 고른 뒤 대화상자를 닫는다.
async function chooseSource(name: string): Promise<void> {
  const chip = document.querySelector<HTMLButtonElement>(
    'main > header button[aria-label^="화면 캡처, "]'
  )!
  await act(async () => chip.click())
  const trigger = document.querySelector<HTMLButtonElement>(
    '[role="dialog"] button[aria-haspopup="menu"]'
  )!
  await act(async () => trigger.click())
  const option = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
    (item) => item.getAttribute('aria-label') === name
  )!
  await act(async () => option.click())
  const close = [...document.querySelectorAll('button')].find(
    (button) => button.textContent === '닫기'
  )!
  await act(async () => close.click())
}

function beginCount(f: Fixture): number {
  const begins = f.search.controlCharacterSearch.mock.calls.filter(
    ([command]) => command.action === 'begin'
  )

  return begins.length
}

async function mount(f: Fixture): Promise<void> {
  await f.mount(
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  )
}

it('캡처 버튼은 상단 바가 아니라 파티 머리에만 있고 대화상자를 열지 않는다', async () => {
  const f = createRendererFixture()
  f.capture.listCaptureSources.mockResolvedValue([{ id: 'game', name: '던전앤파이터' }])
  await mount(f)
  const button = captureButton()
  expect(document.querySelectorAll('button[aria-label="파티 캡처, 단축키 Alt R"]')).toHaveLength(1)
  expect(button.closest('header')).toBeNull()
  expect(button.closest('section[aria-label="공대"]')).toBeNull()
  expect(button.getAttribute('aria-haspopup')).toBeNull()
  expect(button.getAttribute('aria-keyshortcuts')).toBe('Alt+R')
  expect([...button.querySelectorAll('kbd')].map((kbd) => kbd.textContent)).toEqual(['Alt', 'R'])
  await press(f, '캡처 버튼')
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(beginCount(f)).toBe(1)
})

it.each(triggers)(
  '창을 등록하기 전 %s은 회차를 시작하지 않고 버튼은 누를 수 없다',
  async (trigger) => {
    const f = createRendererFixture()
    f.capture.listCaptureSources.mockResolvedValue([])
    await mount(f)
    expect(captureButton().disabled).toBe(true)
    await press(f, trigger)
    expect(beginCount(f)).toBe(0)
    expect(f.readCaptureFrame).not.toHaveBeenCalled()
    expect(partyStatus()).toBe('캡처 대기')
  }
)

it.each(triggers)(
  '창을 등록한 뒤 %s은 같은 회차를 시작하고 같은 결과 문구로 끝난다',
  async (trigger) => {
    const f = createRendererFixture()
    f.capture.listCaptureSources.mockResolvedValue([{ id: 'game', name: '던전앤파이터' }])
    await mount(f)
    expect(partyStatus()).toBe('Alt+R을 눌러 파티를 인식해 주세요.')
    expect(captureButton().disabled).toBe(false)
    await press(f, trigger)
    expect(beginCount(f)).toBe(1)
    expect(f.readCaptureFrame).toHaveBeenCalledOnce()
    // 합성 프레임에는 파티 프레임이 없어 두 경로 모두 같은 안내로 회차를 끝낸다.
    expect(partyStatus()).toBe(
      '파티 프레임을 찾지 못했습니다. 파티 프레임이 보이게 한 뒤 Alt+R을 누르세요.'
    )
    expect(captureButton().disabled).toBe(false)
  }
)

it.each(triggers)('검색 수명을 시작하는 동안 누른 %s은 무시한다', async (trigger) => {
  const f = createRendererFixture()
  f.capture.listCaptureSources.mockResolvedValue([{ id: 'game', name: '던전앤파이터' }])
  const begin = Promise.withResolvers<ReturnType<Fixture['result']>>()
  const control = f.search.controlCharacterSearch.getMockImplementation()!
  f.search.controlCharacterSearch.mockImplementation((command) =>
    command.action === 'begin' ? begin.promise : control(command)
  )
  await mount(f)
  await f.restart()
  expect(beginCount(f)).toBe(1)
  expect(partyStatus()).toBe('파티를 인식하고 있습니다.')
  expect(captureButton().disabled).toBe(true)
  await press(f, trigger)
  expect(beginCount(f)).toBe(1)
  expect(f.readCaptureFrame).not.toHaveBeenCalled()
})

it.each(triggers)('캡처를 중지한 뒤 %s은 회차를 시작하지 않는다', async (trigger) => {
  const f = createRendererFixture()
  f.capture.listCaptureSources.mockResolvedValue([{ id: 'game', name: '던전앤파이터' }])
  await mount(f)
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>('main > header button[aria-label^="화면 캡처, "]')!
      .click()
  )
  const stop = [...document.querySelectorAll('button')].find(
    (button) => button.textContent === '캡처 중지'
  )!
  await act(async () => stop.click())
  expect(partyStatus()).toBe('캡처를 중지했습니다.')
  expect(captureButton().disabled).toBe(true)
  await press(f, trigger)
  expect(beginCount(f)).toBe(0)
  expect(partyStatus()).toBe('캡처를 중지했습니다.')
})

it.each(triggers)('로그인하지 않아도 %s은 회차를 시작한다', async (trigger) => {
  const f = createRendererFixture()
  f.capture.listCaptureSources.mockResolvedValue([{ id: 'game', name: '던전앤파이터' }])
  await mount(f)
  await f.emitAuth(authSnapshot({ revision: 2, signedIn: false }))
  await press(f, trigger)
  expect(beginCount(f)).toBe(1)
  expect(f.readCaptureFrame).toHaveBeenCalledOnce()
})

it.each(triggers)(
  '%s을 눌러 인식을 마치면 마지막 캡처 시간이 상대 시간으로 바뀌고 중지하면 -로 돌아간다',
  async (trigger) => {
    const f = createRendererFixture()
    f.capture.listCaptureSources.mockResolvedValue([{ id: 'game', name: '던전앤파이터' }])
    media.crops.mockReturnValue([document.createElement('canvas'), null, null, null])
    f.resources.worker.recognize.mockResolvedValue({
      data: {
        text: 'ALICE',
        confidence: 1,
        candidates: [{ nickname: 'ALICE', rank: 1, modelScore: 1 }]
      }
    })
    await mount(f)
    expect(lastCapture()).toBe('-')
    await press(f, trigger)
    expect(partyStatus()).toBe('인식을 마쳤습니다. 다시 인식하려면 Alt+R을 누르세요.')
    expect(lastCapture()).toBe('0초 전')
    expect(document.querySelector('time')).not.toBeNull()
    await act(async () =>
      document
        .querySelector<HTMLButtonElement>('main > header button[aria-label^="화면 캡처, "]')!
        .click()
    )
    const stop = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === '캡처 중지'
    )!
    await act(async () => stop.click())
    expect(lastCapture()).toBe('-')
  }
)

it('새 회차가 진행되는 동안 이전 완료 시각을 유지하고 다른 창을 고르면 -로 돌아간다', async () => {
  const f = createRendererFixture()
  media.crops.mockReturnValue([document.createElement('canvas'), null, null, null])
  const second = Promise.withResolvers<Awaited<ReturnType<typeof f.resources.worker.recognize>>>()
  f.resources.worker.recognize
    .mockResolvedValueOnce({
      data: {
        text: 'ALICE',
        confidence: 1,
        candidates: [{ nickname: 'ALICE', rank: 1, modelScore: 1 }]
      }
    })
    .mockReturnValueOnce(second.promise)
  await mount(f)
  await chooseSource('Synthetic game')
  await press(f, '캡처 버튼')
  expect(lastCapture()).toBe('0초 전')
  await press(f, '캡처 버튼')
  expect(partyStatus()).toBe('파티를 인식하고 있습니다.')
  expect(lastCapture()).toBe('0초 전')
  await chooseSource('Next game')
  expect(lastCapture()).toBe('-')
})

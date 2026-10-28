// @vitest-environment jsdom
import { act } from 'react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createRendererFixture, media } from './testing/fixtures/search-renderer-test-fixture'
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

async function press(f: Fixture, trigger: Trigger): Promise<void> {
  if (trigger === 'Alt+R') {
    await f.restart()

    return
  }
  await act(async () => captureButton().click())
}

function captureState(): string | null {
  return document
    .querySelector('main > header button[aria-label^="화면 캡처, "]')!
    .getAttribute('aria-label')
}

function partyNotice(): string | null {
  const heading = [...document.querySelectorAll('h1')].find((h1) => h1.textContent === '파티')!

  return heading.parentElement!.querySelector('[role="status"]')!.textContent
}

function lastCapture(): string | null {
  const label = [...document.querySelectorAll('span')].find(
    (span) => span.textContent === '마지막 캡처'
  )!

  return label.nextElementSibling!.textContent
}

async function chooseSource(name: string): Promise<void> {
  const chip = document.querySelector<HTMLButtonElement>(
    'main > header button[aria-label^="화면 캡처, "]'
  )!
  await act(async () => chip.click())
  const option = [
    ...document.querySelectorAll<HTMLInputElement>('[role="dialog"] input[type="radio"]')
  ].find((item) => item.getAttribute('aria-label') === name)!
  await act(async () => option.click())
  const close = document.querySelector<HTMLButtonElement>('[role="dialog"] [aria-label="닫기"]')!
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

it('캡처 버튼은 상단 바에 그린 파티 머리에만 있고 대화상자를 열지 않는다', async () => {
  const f = createRendererFixture()
  f.capture.listCaptureSources.mockResolvedValue([{ id: 'game', name: '던전앤파이터' }])
  await mount(f)
  const button = captureButton()
  expect(document.querySelectorAll('button[aria-label="파티 캡처, 단축키 Alt R"]')).toHaveLength(1)
  expect(button.closest('main > header')).not.toBeNull()
  expect(document.querySelector('button[aria-label="공대 캡처, 단축키 Alt R"]')).toBeNull()
  expect(button.closest('section[aria-label="공대"]')).toBeNull()
  expect(button.getAttribute('aria-haspopup')).toBeNull()
  expect(button.getAttribute('aria-keyshortcuts')).toBe('Alt+R')
  expect(button.querySelector('kbd')).toBeNull()
  expect(button.querySelector('svg')).not.toBeNull()
  expect(button.textContent).toBe('Alt R')
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
    expect(captureState()).toBe('화면 캡처, 창 미감지')
  }
)

it.each(triggers)(
  '창을 등록한 뒤 %s은 같은 회차를 시작하고 같은 상태로 끝나며 파티 머리에 진행 문구를 두지 않는다',
  async (trigger) => {
    const f = createRendererFixture()
    f.capture.listCaptureSources.mockResolvedValue([{ id: 'game', name: '던전앤파이터' }])
    await mount(f)
    expect(captureState()).toBe('화면 캡처, 창 감지됨')
    expect(captureButton().disabled).toBe(false)
    await press(f, trigger)
    expect(beginCount(f)).toBe(1)
    expect(f.readCaptureFrame).toHaveBeenCalledOnce()
    expect(captureState()).toBe('화면 캡처, 확인 필요')
    expect(partyNotice()).toBe('')
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
  expect(captureState()).toBe('화면 캡처, 인식 중')
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
  expect(captureState()).toBe('화면 캡처, 창 감지됨')
  expect(captureButton().disabled).toBe(true)
  await press(f, trigger)
  expect(beginCount(f)).toBe(0)
  expect(captureState()).toBe('화면 캡처, 창 감지됨')
})

it.each(triggers)(
  '인식이 진행되는 동안 누른 %s은 이전 회차를 정리하고 처음부터 다시 시작한다',
  async (trigger) => {
    const f = createRendererFixture()
    f.capture.listCaptureSources.mockResolvedValue([{ id: 'game', name: '던전앤파이터' }])
    media.crops.mockReturnValue([document.createElement('canvas'), null, null, null])
    const first = Promise.withResolvers<Awaited<ReturnType<typeof f.resources.worker.recognize>>>()
    f.resources.worker.recognize.mockReturnValueOnce(first.promise).mockResolvedValueOnce({
      data: {
        text: 'NEW',
        confidence: 1,
        candidates: [{ nickname: 'NEW', rank: 1, modelScore: 1 }]
      }
    })
    await mount(f)
    await f.restart()
    expect(captureState()).toBe('화면 캡처, 인식 중')
    expect(captureButton().disabled).toBe(false)
    const firstRound = media.worker.mock.calls[0][0] as AbortSignal
    await press(f, trigger)
    expect(firstRound.aborted).toBe(true)
    expect(beginCount(f)).toBe(2)
    expect(f.readCaptureFrame).toHaveBeenCalledTimes(2)
    await act(async () =>
      first.resolve({
        data: {
          text: 'OLD',
          confidence: 1,
          candidates: [{ nickname: 'OLD', rank: 1, modelScore: 1 }]
        }
      })
    )
    expect(f.capture.notifyOcrCandidatesDetected).not.toHaveBeenCalledWith(
      expect.objectContaining({ nickname: 'OLD' })
    )
    expect(captureState()).toBe('화면 캡처, 인식 완료')
    expect(document.querySelector<HTMLInputElement>('[aria-label="1번 캐릭터 이름"]')!.value).toBe(
      'NEW'
    )
  }
)

it.each(triggers)('창을 감지하면 %s이 회차를 시작한다', async (trigger) => {
  const f = createRendererFixture()
  f.capture.listCaptureSources.mockResolvedValue([{ id: 'game', name: '던전앤파이터' }])
  await mount(f)
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
    expect(captureState()).toBe('화면 캡처, 인식 완료')
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
  expect(captureState()).toBe('화면 캡처, 인식 중')
  expect(lastCapture()).toBe('0초 전')
  await chooseSource('Next game')
  expect(lastCapture()).toBe('-')
})

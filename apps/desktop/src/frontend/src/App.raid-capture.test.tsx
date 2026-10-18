// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRendererFixture } from './testing/fixtures/search-renderer-test-fixture'
import App from './App'
import { ColorThemeProvider } from './components/ColorThemeProvider'
import { emptySearchSlots } from './lib/slots'
import { searchSlot, searchSnapshot } from '../../preload/api/search-test-fixture'
import type { RaidFrameResult } from '../../preload/common/types/capture'
import type { AsyncIPCFunctions } from '../../preload/common/types/ipc'
import type { SearchApi, SearchSnapshot } from '../../preload/common/types/search'
import type { RaidSlotRecognition } from './lib/raid-recognition'

const raidMocks = vi.hoisted(() => ({ recognize: vi.fn() }))
vi.mock('./lib/raid-recognition', () => ({ recognizeRaidRows: raidMocks.recognize }))

type Fixture = ReturnType<typeof createRendererFixture>
type Trigger = 'Alt+R' | '캡처 버튼'
const triggers: Trigger[] = ['Alt+R', '캡처 버튼']
const crop = { width: 86, height: 17, rgba: new Uint8Array(86 * 17 * 4) }
const frame: RaidFrameResult = {
  kind: 'rows',
  nicknames: Array.from({ length: 12 }, (_, row) => (row < 2 ? crop : null))
}
const recognized: RaidSlotRecognition[] = [
  { kind: 'recognized', nickname: '첫째공대원', slot: 0 },
  { kind: 'recognized', nickname: '둘째공대원', slot: 1 },
  ...Array.from({ length: 10 }, (_, index) => ({ kind: 'missing' as const, slot: index + 2 }))
]

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
  raidMocks.recognize.mockResolvedValue(recognized)
})
afterEach(() => vi.unstubAllGlobals())

// 공대 수명의 합성 main. begin마다 새 수명 ID로 12자리를 비우고 OCR 이름은 그 자리를 조회 중으로 둔다.
function stubRaidSearch() {
  let snapshot: SearchSnapshot = searchSnapshot({ captureId: null, slots: emptySearchSlots(12) })
  let sequence = 0
  const listeners = new Set<(snapshot: SearchSnapshot) => void>()
  const control = vi.fn<SearchApi['controlCharacterSearch']>(async (command) => {
    if (command.action === 'begin') {
      sequence += 1
      const captureId = `00000000-0000-4000-8000-${String(500 + sequence).padStart(12, '0')}`
      snapshot = {
        ...snapshot,
        captureId,
        revision: snapshot.revision + 1,
        slots: emptySearchSlots(12)
      }
    }

    return { ok: true, snapshot }
  })
  const notifyOcr = vi.fn<AsyncIPCFunctions['notifyRaidOcrCandidatesDetected']>(
    async (observation) => {
      const slots = snapshot.slots.map((slot) => {
        if (slot.slot !== observation.slot) {
          return slot
        }
        const { nickname, observationRevision } = observation

        return searchSlot({
          slot: slot.slot,
          nickname,
          observationRevision,
          state: 'pending',
          rows: []
        })
      })
      snapshot = { ...snapshot, revision: snapshot.revision + 1, slots }
      for (const listener of listeners) {
        listener(snapshot)
      }

      return { ok: true, snapshot }
    }
  )
  const readCaptureFrame = vi.fn<AsyncIPCFunctions['readRaidCaptureFrame']>(async () => frame)
  vi.stubGlobal('raidSearch', {
    controlCharacterSearch: control,
    onCharacterSearchChanged: vi.fn<SearchApi['onCharacterSearchChanged']>((listener) => {
      listeners.add(listener)

      return () => listeners.delete(listener)
    }),
    notifyOcrCandidatesDetected: notifyOcr,
    readCaptureFrame
  })
  const begins = (): number =>
    control.mock.calls.filter(([command]) => command.action === 'begin').length

  return { control, notifyOcr, readCaptureFrame, begins }
}

function partyBegins(f: Fixture): number {
  return f.search.controlCharacterSearch.mock.calls.filter(
    ([command]) => command.action === 'begin'
  ).length
}

function raidSection(): HTMLElement {
  return document.querySelector<HTMLElement>('section[aria-label="공대"]')!
}

function raidCaptureButton(): HTMLButtonElement {
  const button = raidSection().querySelector<HTMLButtonElement>(
    'button[aria-label="공대 캡처, 단축키 Alt R"]'
  )
  expect(button).not.toBeNull()

  return button!
}

function raidStatus(): string | null {
  return raidSection().querySelector('[role="status"]')!.textContent
}

function chipLabel(): string | null {
  return document
    .querySelector<HTMLButtonElement>('main > header button[aria-label^="화면 캡처, "]')!
    .getAttribute('aria-label')
}

async function showScreen(name: '파티' | '공대'): Promise<void> {
  const trigger = document.querySelector<HTMLButtonElement>('nav button[aria-haspopup="menu"]')!
  await act(async () => trigger.click())
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
    (menuItem) => menuItem.textContent === name
  )!
  await act(async () => item.click())
}

async function press(f: Fixture, trigger: Trigger): Promise<void> {
  if (trigger === 'Alt+R') {
    await f.restart()

    return
  }
  await act(async () => raidCaptureButton().click())
}

async function mount(f: Fixture): Promise<void> {
  f.capture.listCaptureSources.mockResolvedValue([{ id: 'game', name: '던전앤파이터' }])
  await f.mount(
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  )
}

it('공대 머리에 파티와 같은 모양의 캡처 버튼과 마지막 캡처를 두고 대화상자를 열지 않는다', async () => {
  const f = createRendererFixture()
  stubRaidSearch()
  await mount(f)
  await showScreen('공대')
  const button = raidCaptureButton()
  expect(button.getAttribute('aria-keyshortcuts')).toBe('Alt+R')
  expect([...button.querySelectorAll('kbd')].map((kbd) => kbd.textContent)).toEqual(['Alt', 'R'])
  expect(raidSection().textContent).toContain('마지막 캡처')
  expect(raidStatus()).toBe('Alt+R을 눌러 공대를 인식해 주세요.')
  await act(async () => button.click())
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it.each(triggers)(
  '공대 화면의 %s은 공대 회차만 시작해 12자리를 채우고 파티 캡처는 시작하지 않는다',
  async (trigger) => {
    const f = createRendererFixture()
    const raid = stubRaidSearch()
    await mount(f)
    await showScreen('공대')

    await press(f, trigger)

    await vi.waitFor(() => expect(raid.notifyOcr).toHaveBeenCalledTimes(2))
    expect(raid.begins()).toBe(1)
    const beginIndex = raid.control.mock.calls.findIndex(([command]) => command.action === 'begin')
    const begun = await raid.control.mock.results[beginIndex].value
    expect(raid.readCaptureFrame).toHaveBeenCalledExactlyOnceWith(begun.snapshot.captureId)
    expect(raid.notifyOcr.mock.calls.map(([observation]) => observation)).toEqual([
      expect.objectContaining({
        slot: 0,
        nickname: '첫째공대원',
        candidateNicknames: ['첫째공대원'],
        portrait: null
      }),
      expect.objectContaining({ slot: 1, nickname: '둘째공대원', portrait: null })
    ])
    expect(partyBegins(f)).toBe(0)
    expect(f.readCaptureFrame).not.toHaveBeenCalled()
    expect(raidStatus()).toBe('인식을 마쳤습니다. 다시 인식하려면 Alt+R을 누르세요.')
    const names = [
      ...raidSection().querySelectorAll<HTMLInputElement>('input[aria-label$="캐릭터 이름"]')
    ]
    expect(names.slice(0, 3).map((input) => input.value)).toEqual(['첫째공대원', '둘째공대원', ''])
    expect(chipLabel()).toBe('화면 캡처, 인식 완료')
  }
)

it('파티 화면의 Alt+R은 파티 회차만 시작하고 공대 프레임을 읽지 않는다', async () => {
  const f = createRendererFixture()
  const raid = stubRaidSearch()
  await mount(f)

  await f.restart()

  expect(partyBegins(f)).toBe(1)
  expect(f.readCaptureFrame).toHaveBeenCalledOnce()
  expect(raid.begins()).toBe(0)
  expect(raid.readCaptureFrame).not.toHaveBeenCalled()
})

it('공대 회차 중 파티로 옮겨도 늦은 결과는 공대 자리에만 들어가고 파티 Alt+R은 파티 회차를 시작한다', async () => {
  const f = createRendererFixture()
  const raid = stubRaidSearch()
  const late = Promise.withResolvers<RaidSlotRecognition[]>()
  raidMocks.recognize.mockReturnValueOnce(late.promise)
  await mount(f)
  await showScreen('공대')
  await f.restart()
  await vi.waitFor(() => expect(raidMocks.recognize).toHaveBeenCalledOnce())

  await showScreen('파티')
  await act(async () => late.resolve(recognized))

  await vi.waitFor(() => expect(raid.notifyOcr).toHaveBeenCalledTimes(2))
  expect(f.capture.notifyOcrCandidatesDetected).not.toHaveBeenCalled()
  const partyNames = [
    ...document.querySelectorAll<HTMLInputElement>(
      '[aria-label="파티 캐릭터"] input[aria-label$="캐릭터 이름"]'
    )
  ]
  expect(partyNames.every((input) => input.value === '')).toBe(true)

  await f.restart()
  expect(partyBegins(f)).toBe(1)
  expect(raid.begins()).toBe(1)
  expect(raid.readCaptureFrame).toHaveBeenCalledOnce()
})

it.each(triggers)('창을 등록하기 전 공대 화면의 %s은 회차를 시작하지 않는다', async (trigger) => {
  const f = createRendererFixture()
  const raid = stubRaidSearch()
  f.capture.listCaptureSources.mockResolvedValue([])
  await f.mount(
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  )
  await showScreen('공대')
  expect(raidCaptureButton().disabled).toBe(true)
  expect(raidStatus()).toBe('캡처 대기')

  await press(f, trigger)

  expect(raid.begins()).toBe(0)
  expect(raid.readCaptureFrame).not.toHaveBeenCalled()
})

it('공대 상세 창이 없으면 공대 머리와 상태 칩이 확인 필요를 알리고 이름을 알리지 않는다', async () => {
  const f = createRendererFixture()
  const raid = stubRaidSearch()
  raid.readCaptureFrame.mockResolvedValue({ kind: 'missing', reason: 'not-found' })
  await mount(f)
  await showScreen('공대')

  await act(async () => raidCaptureButton().click())

  await vi.waitFor(() =>
    expect(raidStatus()).toBe(
      '공대 상세 창을 찾지 못했습니다. 12인 공대 상세 창을 연 뒤 Alt+R을 누르세요.'
    )
  )
  expect(chipLabel()).toBe('화면 캡처, 확인 필요')
  expect(raid.notifyOcr).not.toHaveBeenCalled()
  expect(raidCaptureButton().disabled).toBe(false)
  // 파티 화면의 상태 칩은 파티 회차를 보인다.
  await showScreen('파티')
  expect(chipLabel()).toBe('화면 캡처, 창 감지됨')
})

it('공대 회차 중 캡처를 중지하면 회차를 끝내고 늦은 이름을 알리지 않는다', async () => {
  const f = createRendererFixture()
  const raid = stubRaidSearch()
  const late = Promise.withResolvers<RaidSlotRecognition[]>()
  raidMocks.recognize.mockReturnValueOnce(late.promise)
  await mount(f)
  await showScreen('공대')
  await f.restart()
  await vi.waitFor(() => expect(raidMocks.recognize).toHaveBeenCalledOnce())

  await act(async () =>
    document
      .querySelector<HTMLButtonElement>('main > header button[aria-label^="화면 캡처, "]')!
      .click()
  )
  const stop = [...document.querySelectorAll('button')].find(
    (button) => button.textContent === '캡처 중지'
  )!
  await act(async () => stop.click())
  await act(async () => late.resolve(recognized))

  expect(raid.notifyOcr).not.toHaveBeenCalled()
  expect(raidStatus()).toBe('캡처를 중지했습니다.')
  expect(raidCaptureButton().disabled).toBe(true)
})

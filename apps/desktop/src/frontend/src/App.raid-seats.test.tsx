// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRendererFixture } from './testing/fixtures/search-renderer-test-fixture'
import App from './App'
import { ColorThemeProvider } from './components/ColorThemeProvider'
import { emptySearchSlots } from './lib/slots'
import { searchRow, searchSlot, searchSnapshot } from '../../preload/api/search-test-fixture'
import { characterImageUrl } from '../../preload/common/search/character-summary'
import type { RaidFrameResult } from '../../preload/common/types/capture'
import type { SelectedCharacterSummary } from '../../preload/common/types/character'
import type { AsyncIPCFunctions } from '../../preload/common/types/ipc'
import type { SearchApi, SearchSlot, SearchSnapshot } from '../../preload/common/types/search'
import type { RaidSlotRecognition } from './lib/raid-recognition'

const raidMocks = vi.hoisted(() => ({ recognize: vi.fn() }))
vi.mock('./lib/raid-recognition', () => ({ recognizeRaidRows: raidMocks.recognize }))

type Fixture = ReturnType<typeof createRendererFixture>
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

function selected(name: string): SelectedCharacterSummary {
  const character = { serverId: 'siroco', characterId: 'synthetic-character' }

  return {
    characterId: character.characterId,
    characterName: name,
    serverId: 'siroco',
    serverName: '시로코',
    adventureName: '합성모험단',
    jobName: '합성직업',
    jobGrowName: null,
    level: 115,
    fame: 100000,
    imageUrl: characterImageUrl(character),
    guildName: null,
    equipmentScore: null,
    serverRank: null,
    card: null
  }
}

// 공대 수명의 합성 main. begin마다 12자리를 비우고, 조회 응답은 테스트가 원하는 때 publish로 보낸다.
function stubRaidSearch() {
  let snapshot: SearchSnapshot = searchSnapshot({ captureId: null, slots: emptySearchSlots(12) })
  let sequence = 0
  const listeners = new Set<(snapshot: SearchSnapshot) => void>()
  const publish = (slots: SearchSlot[]): void => {
    snapshot = { ...snapshot, revision: snapshot.revision + 1, slots }
    for (const listener of listeners) {
      listener(snapshot)
    }
  }
  const control = vi.fn<SearchApi['controlCharacterSearch']>(async (command) => {
    if (command.action === 'begin') {
      sequence += 1
      const captureId = `00000000-0000-4000-8000-${String(700 + sequence).padStart(12, '0')}`
      snapshot = {
        ...snapshot,
        captureId,
        revision: snapshot.revision + 1,
        slots: emptySearchSlots(12)
      }
    }

    if (command.action === 'lookup') {
      const slots = snapshot.slots.map((slot) =>
        slot.slot === command.slot
          ? searchSlot({ slot: slot.slot, nickname: command.nickname, state: 'pending' })
          : slot
      )
      snapshot = { ...snapshot, revision: snapshot.revision + 1, slots }
    }

    return { ok: true, snapshot }
  })
  const notifyOcr = vi.fn<AsyncIPCFunctions['notifyRaidOcrCandidatesDetected']>(async () => ({
    ok: true,
    snapshot
  }))
  vi.stubGlobal('raidSearch', {
    controlCharacterSearch: control,
    onCharacterSearchChanged: vi.fn<SearchApi['onCharacterSearchChanged']>((listener) => {
      listeners.add(listener)

      return () => listeners.delete(listener)
    }),
    notifyOcrCandidatesDetected: notifyOcr,
    readCaptureFrame: vi.fn<AsyncIPCFunctions['readRaidCaptureFrame']>(async () => frame)
  })
  const lookups = () =>
    control.mock.calls.flatMap(([command]) => (command.action === 'lookup' ? [command] : []))

  return { publish, lookups, notifyOcr, current: () => snapshot }
}

function raidSection(): HTMLElement {
  return document.querySelector<HTMLElement>('section[aria-label="공대"]')!
}

function seats(): HTMLElement[] {
  return [...raidSection().querySelectorAll<HTMLElement>('[aria-label*="번 자리"]')]
}

function names(): string[] {
  return seats().map(
    (seat) => seat.querySelector<HTMLInputElement>('input[aria-label$="캐릭터 이름"]')!.value
  )
}

async function showRaid(): Promise<void> {
  const trigger = document.querySelector<HTMLButtonElement>('nav button[aria-haspopup="menu"]')!
  await act(async () => trigger.click())
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
    (menuItem) => menuItem.textContent === '공대'
  )!
  await act(async () => item.click())
}

async function lookup(seat: HTMLElement, name: string): Promise<void> {
  const input = seat.querySelector<HTMLInputElement>('input[aria-label$="캐릭터 이름"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, name)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const server = seat.querySelector<HTMLButtonElement>('[aria-label$="번 서버"]')!
  await act(async () => server.click())
  // 앞서 연 다른 자리의 목록이 남아 있어도 이 자리 서버 목록의 항목을 고른다.
  const label = server.getAttribute('aria-label')
  const siroco = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (option) =>
      option.textContent === '시로코' &&
      option.closest(`[aria-label="${label}"]:not(button)`) !== null
  )!
  await act(async () => siroco.click())
}

async function moveRight(seat: HTMLElement): Promise<void> {
  await act(async () =>
    seat.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true })
    )
  )
}

async function mount(f: Fixture): Promise<void> {
  f.capture.listCaptureSources.mockResolvedValue([{ id: 'game', name: '던전앤파이터' }])
  await f.mount(
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  )
}

it('맞바꾸면 진행 중 조회의 늦은 응답은 옮겨 간 카드에 들어가고 빈 자리의 새 조회는 그 자리의 슬롯으로 간다', async () => {
  const f = createRendererFixture()
  const raid = stubRaidSearch()
  await mount(f)
  await showRaid()

  await lookup(seats()[0], '첫째')
  await vi.waitFor(() => expect(raid.lookups()).toHaveLength(1))
  expect(raid.lookups()[0]).toMatchObject({ slot: 0, nickname: '첫째' })
  await moveRight(seats()[0])
  expect(seats()[1].querySelector('article')!.getAttribute('aria-busy')).toBe('true')
  expect(names().slice(0, 2)).toEqual(['', '첫째'])

  // 슬롯 0의 늦은 응답은 2번 자리로 옮겨 간 카드에만 들어간다.
  const slots = [...raid.current().slots]
  slots[0] = {
    ...searchSlot({
      slot: 0,
      nickname: '첫째',
      state: 'success',
      rows: [{ ...searchRow, characterName: '첫째', serverId: 'siroco', serverName: '시로코' }]
    }),
    selected: selected('첫째'),
    selectionMethod: 'manual'
  }
  await act(async () => raid.publish(slots))
  expect(names().slice(0, 2)).toEqual(['', '첫째'])
  expect(seats()[1].querySelector('article')!.getAttribute('data-state')).toBe('default')
  expect(seats()[1].textContent).toContain('합성모험단')
  expect(seats()[0].querySelector('article')!.getAttribute('data-state')).toBe('waiting')
  expect(seats()[0].textContent).not.toContain('합성모험단')
  expect(raidSection().textContent).toContain('1/12')

  // 1번 자리에는 슬롯 1이 놓여 새 조회는 슬롯 1로 가고 슬롯 0의 결과를 건드리지 않는다.
  await lookup(seats()[0], '둘째')
  await vi.waitFor(() => expect(raid.lookups()).toHaveLength(2))
  expect(raid.lookups()[1]).toMatchObject({ slot: 1, nickname: '둘째' })
  expect(seats()[1].textContent).toContain('합성모험단')
})

it('공대 캡처가 인식하는 동안은 자리를 옮기지 않고, 회차는 배치를 처음으로 되돌려 화면 행 순서대로 채운다', async () => {
  const f = createRendererFixture()
  const raid = stubRaidSearch()
  const late = Promise.withResolvers<RaidSlotRecognition[]>()
  raidMocks.recognize.mockReturnValueOnce(late.promise)
  await mount(f)
  await showRaid()
  await lookup(seats()[0], '옮길카드')
  await moveRight(seats()[0])
  expect(names().slice(0, 2)).toEqual(['', '옮길카드'])

  await f.restart()
  await vi.waitFor(() => expect(raidMocks.recognize).toHaveBeenCalledOnce())
  expect(seats()[0].getAttribute('aria-label')).toBe('1번 자리')
  expect(seats()[0].getAttribute('draggable')).toBe('false')
  // 인식 중 맞바꾸기가 받아들여졌다면 아래에서 1행 이름이 2번 자리에 보인다.
  await moveRight(seats()[0])
  expect(seats()[0].getAttribute('aria-label')).toBe('1번 자리')

  await act(async () => late.resolve(recognized))
  await vi.waitFor(() => expect(raid.notifyOcr).toHaveBeenCalledTimes(2))
  // 1행과 2행의 이름은 1번, 2번 자리의 슬롯 0, 1로 간다.
  expect(raid.notifyOcr.mock.calls.map(([observation]) => observation.slot)).toEqual([0, 1])
  expect(names().slice(0, 3)).toEqual(['첫째공대원', '둘째공대원', ''])
  expect(seats()[0].getAttribute('aria-label')).toBe('1번 자리, 끌어서 옮기기')

  // 인식을 마친 뒤에는 다시 옮길 수 있고 인식한 이름도 카드와 함께 옮겨 간다.
  await moveRight(seats()[0])
  expect(names().slice(0, 2)).toEqual(['둘째공대원', '첫째공대원'])
})

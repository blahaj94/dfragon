// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRendererFixture } from './testing/fixtures/search-renderer-test-fixture'
import App from './App'
import { stubIdleDesktopBridges } from './testing/fixtures/idle-desktop-bridges'
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
  valueColumn: 'fame',
  rows: Array.from({ length: 12 }, (_, row) =>
    row < 2 ? { nickname: crop, job: crop, valueText: '12,345' } : null
  )
}
const recognized: RaidSlotRecognition[] = [
  { kind: 'recognized', nickname: '첫째공대원', slot: 0, jobText: '眞 크루세이더' },
  { kind: 'recognized', nickname: '둘째공대원', slot: 1, jobText: '眞 크루세이더' },
  ...Array.from({ length: 10 }, (_, index) => ({ kind: 'missing' as const, slot: index + 2 }))
]

beforeEach(() => {
  stubIdleDesktopBridges()
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

function selected(name: string, adventureName = '합성모험단'): SelectedCharacterSummary {
  const character = { serverId: 'siroco', characterId: 'synthetic-character' }

  return {
    characterId: character.characterId,
    characterName: name,
    serverId: 'siroco',
    serverName: '시로코',
    adventureName,
    jobName: '합성직업',
    jobGrowName: null,
    level: 115,
    fame: 100000,
    imageUrl: characterImageUrl(character),
    guildName: null,
    equipmentScore: null,
    card: null
  }
}

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

function raidHeader(): HTMLElement {
  const heading = [...document.querySelectorAll('main > header h1')].find(
    (h1) => h1.textContent === '공대'
  )
  expect(heading).toBeDefined()

  return heading!.parentElement!.parentElement!
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
  await f.mount(<App />)
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
  expect(raidHeader().textContent).toContain('1/12')

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
  expect(raid.notifyOcr.mock.calls.map(([observation]) => observation.slot)).toEqual([0, 1])
  expect(names().slice(0, 3)).toEqual(['첫째공대원', '둘째공대원', ''])
  expect(seats()[0].getAttribute('aria-label')).toBe('1번 자리, 끌어서 옮기기')

  await moveRight(seats()[0])
  expect(names().slice(0, 2)).toEqual(['둘째공대원', '첫째공대원'])
})

function foundSlot(slot: number, name: string, adventure: string): SearchSlot {
  return {
    ...searchSlot({
      slot,
      nickname: name,
      state: 'success',
      rows: [{ ...searchRow, characterName: name, serverId: 'siroco', serverName: '시로코' }]
    }),
    selected: selected(name, adventure),
    selectionMethod: 'manual'
  }
}

function snapshotButton(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('[aria-label="공대 모험단 순번 스냅샷"]')!
}

function chipsOf(seat: HTMLElement): string[] {
  return [...seat.querySelectorAll('[role="img"][aria-label^="스냅샷"]')].map(
    (chip) => chip.getAttribute('aria-label')!
  )
}

it('공대 스냅샷을 켠 뒤 자리를 옮기면 바뀐 카드에 순번 칩이, 새 모험단에 경고가 보이고 지우면 모두 걷힌다', async () => {
  const f = createRendererFixture()
  const raid = stubRaidSearch()
  await mount(f)
  await showRaid()
  await lookup(seats()[0], '첫째')
  await lookup(seats()[1], '둘째')
  await vi.waitFor(() => expect(raid.lookups()).toHaveLength(2))
  await act(async () =>
    raid.publish([
      foundSlot(0, '첫째', '가모험단'),
      foundSlot(1, '둘째', '나모험단'),
      ...raid.current().slots.slice(2)
    ])
  )

  await act(async () => snapshotButton().click())
  expect(snapshotButton().getAttribute('aria-pressed')).toBe('true')
  expect(raidHeader().querySelector('[aria-label="1번째 공대"]')?.textContent).toBe('#1')
  expect(seats().flatMap(chipsOf)).toEqual([])

  await moveRight(seats()[0])
  expect(chipsOf(seats()[0])).toEqual(['스냅샷 순번 2'])
  expect(chipsOf(seats()[1])).toEqual(['스냅샷 순번 1'])

  await lookup(seats()[2], '낯선사람')
  await vi.waitFor(() => expect(raid.lookups()).toHaveLength(3))
  await act(async () =>
    raid.publish([
      ...raid.current().slots.slice(0, 2),
      foundSlot(2, '낯선사람', '다른모험단'),
      ...raid.current().slots.slice(3)
    ])
  )
  expect(chipsOf(seats()[0])).toEqual(['스냅샷 순번 2'])
  expect(chipsOf(seats()[1])).toEqual(['스냅샷 순번 1'])
  expect(chipsOf(seats()[2])).toEqual(['스냅샷에 없는 모험단'])

  await act(async () => snapshotButton().click())
  const choice = (name: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(
      (button) => button.textContent === name
    )!
  await act(async () => choice('유지').click())
  await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
  expect(snapshotButton().getAttribute('aria-pressed')).toBe('true')
  expect(chipsOf(seats()[2])).toEqual(['스냅샷에 없는 모험단'])

  await act(async () => snapshotButton().click())
  await act(async () => choice('고정 취소').click())
  expect(snapshotButton().getAttribute('aria-pressed')).toBe('false')
  expect(seats().flatMap(chipsOf)).toEqual([])
})

it('클립보드로 복사는 맞바꾼 화면 자리 순서대로 파티마다 한 줄씩 쓴다', async () => {
  const writeText = vi.fn<Window['desktopClipboard']['writeText']>(async () => {})
  vi.stubGlobal('desktopClipboard', { writeText })
  const f = createRendererFixture()
  const raid = stubRaidSearch()
  await mount(f)
  await showRaid()
  await lookup(seats()[0], '첫째')
  await lookup(seats()[1], '둘째')
  await lookup(seats()[4], '못찾음')
  await vi.waitFor(() => expect(raid.lookups()).toHaveLength(3))
  await act(async () =>
    raid.publish([
      foundSlot(0, '첫째', '가모험단'),
      foundSlot(1, '둘째', '나모험단'),
      ...raid.current().slots.slice(2)
    ])
  )
  await moveRight(seats()[0])

  const copy = raidHeader().querySelector<HTMLButtonElement>(
    'button[aria-label="클립보드로 복사"]'
  )!
  await act(async () => copy.click())

  expect(writeText).toHaveBeenCalledExactlyOnceWith(
    [
      '[둘째, 시로코, 나모험단], [첫째, 시로코, 가모험단], [], []',
      '[못찾음, , ], [], [], []',
      '[], [], [], []'
    ].join('\n')
  )
})

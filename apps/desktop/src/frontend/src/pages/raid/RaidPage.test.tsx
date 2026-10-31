// @vitest-environment jsdom
import { colors, space } from '@dfragon/ui/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ServerSelect } from '../../components/ServerSelect'
import type { SnapshotMark } from '../../lib/adventure-snapshot'
import { RAID_SEAT_LAYOUT } from '../../constants/cards'
import { createSeatOrder, swapSeats } from '../../lib/seats'
import { bufferCard, dealerCard } from '../../testing/fixtures/character-cards'
import { toneClassesOf } from '../../testing/test-support/score-tone-class'
import type { CardCharacter, SlotState } from '../../types/cards'
import { RaidPage } from './RaidPage'

vi.mock('../../components/ServerSelect', () => ({
  ServerSelect: ({ value, onValueChange, label, options }: ComponentProps<typeof ServerSelect>) => (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="">서버 선택</option>
      {options.map(({ id, label }) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </select>
  )
}))

// StyleX의 atomic class 이름은 속성과 값에서 정해지므로, 같은 선언을 여기서 만들면 같은 class가 나온다.
// jsdom은 배치를 계산하지 않으므로 보드가 창 폭을 네 등분하는 트랙과 간격 8을 쓰는지 class로 확인한다.
const expectedLayout = stylex.create({
  columns: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
  gap: { gap: space.s8 },
  scroll: { overflow: 'auto' }
})

const expectedPartyFill = stylex.create({
  red: { backgroundColor: colors.raidPartyRed, color: colors.cardFg },
  yellow: { backgroundColor: colors.raidPartyYellow, color: colors.cardOnSignal },
  green: { backgroundColor: colors.raidPartyGreen, color: colors.cardFg }
})

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

const member: CardCharacter = {
  name: '공대원',
  adventure: '공대모험단',
  guild: '공대길드',
  job: '공대직업',
  serverId: 'cain',
  fame: 120000,
  card: { ...dealerCard, role: null }
}
const idle: SlotState[] = Array.from({ length: 12 }, () => 'idle')

type RenderProps = Partial<Omit<ComponentProps<typeof RaidPage>, 'slots' | 'seats' | 'actions'>> &
  Partial<ComponentProps<typeof RaidPage>['seats']> &
  Partial<ComponentProps<typeof RaidPage>['actions']> & {
    slots?: SlotState[]
    characters?: (CardCharacter | null)[]
    slotNotices?: (string | undefined)[]
    snapshotMarks?: (SnapshotMark | undefined)[]
  }

async function render({
  slots: states,
  characters = [],
  slotNotices,
  snapshotMarks,
  seatOrder = createSeatOrder(RAID_SEAT_LAYOUT),
  canMoveSeats = true,
  swapSeats: swap = vi.fn(() => true),
  lookupSlot = vi.fn(),
  ...props
}: RenderProps = {}): Promise<void> {
  const slots = (states ?? idle).map((state, index) => {
    const shownState: SlotState = states === undefined && characters[index] ? 'success' : state
    const character = characters[index] ?? undefined

    return {
      state: shownState,
      character,
      notice: slotNotices?.[index],
      snapshotMark: snapshotMarks?.[index]
    }
  })
  await act(async () =>
    root.render(
      <RaidPage
        resetKey="raid"
        {...props}
        seats={{ layout: RAID_SEAT_LAYOUT, seatOrder, canMoveSeats, swapSeats: swap }}
        actions={{ lookupSlot }}
        slots={slots}
      />
    )
  )
}

function seats(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[aria-label*="번 자리"]')]
}

function nameOf(seat: HTMLElement): string | undefined {
  return seat.querySelector<HTMLInputElement>('input')?.value
}

async function enterName(seat: HTMLElement, value: string): Promise<HTMLInputElement> {
  const input = seat.querySelector('input')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })

  return input
}

async function pressAlt(target: HTMLElement, key: string, altKey = true): Promise<void> {
  await act(async () =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, altKey, bubbles: true }))
  )
}

const SEAT_DRAG_TYPE = 'application/x-dfragon-seat'

// jsdom에는 DragEvent가 없어 React가 읽는 dataTransfer만 붙인 이벤트로 드래그를 흉내 낸다. 기본은 자리 드래그
// 형식이 담긴 드래그다.
async function drag(
  type: string,
  target: HTMLElement,
  types: string[] = [SEAT_DRAG_TYPE]
): Promise<{ event: Event; setData: () => void }> {
  const dataTransfer = { types, setData: vi.fn(), effectAllowed: '', dropEffect: '' }
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  await act(async () => target.dispatchEvent(event))

  return { event, setData: dataTransfer.setData }
}

function moveNotices(): (string | null)[] {
  return [...container.querySelectorAll('section > [role="status"]')].map(
    (region) => region.textContent
  )
}

function classesOf(style: stylex.StyleXStyles): string[] {
  return (stylex.props(style).className ?? '').split(' ').filter(Boolean)
}

it('세 파티 네 자리씩 12자리를 번호 순서로 놓는다', async () => {
  await render({
    characters: [
      { ...member, job: '眞 공대직업' },
      { ...member, name: '둘째' }
    ]
  })

  expect(seats().map((seat) => seat.getAttribute('aria-label'))).toEqual(
    Array.from({ length: 12 }, (_, index) => `${index + 1}번 자리, 끌어서 옮기기`)
  )
  const partyOf = (seat: HTMLElement): string | undefined =>
    seat
      .getAttribute('aria-describedby')
      ?.split(' ')
      .map((id) => document.getElementById(id)?.textContent)
      .join(', ')
  expect(partyOf(seats()[0])).toBe(
    '1파티, Alt와 방향키로 위, 아래, 왼쪽, 오른쪽 자리와 맞바꿉니다.'
  )
  expect(partyOf(seats()[4])?.startsWith('2파티')).toBe(true)
  expect(partyOf(seats()[11])?.startsWith('3파티')).toBe(true)
  const first = seats()[0]
  expect(first.querySelector('article')?.getAttribute('data-state')).toBe('default')
  expect(nameOf(first)).toBe('공대원')
  expect(first.textContent).toContain('R1')
  expect(first.textContent).not.toContain('01')
  expect(seats()[4].textContent).toContain('Y1')
  expect(seats()[11].textContent).toContain('G4')
  expect(first.textContent).toContain('공대모험단')
  expect(first.textContent).toContain('공대길드')
  const job = first.querySelector<HTMLElement>('[title="공대직업"]')
  expect(job?.textContent).toBe('공대직업')
  const statLine = first.querySelector('dl')?.parentElement
  expect(statLine?.nextElementSibling?.contains(job)).toBe(true)
  expect(first.querySelectorAll('[title="공대직업"]')).toHaveLength(1)
  expect(first.textContent).not.toContain('眞')
  expect(first.textContent).not.toContain('서버 순위')
  expect(first.querySelector('[aria-label="1번 캐릭터 상세 열기"]')).toBeNull()
  expect(container.querySelector('[role="tab"]')).toBeNull()
  const vacant = seats()[11]
  expect(vacant.querySelector('article')?.getAttribute('data-state')).toBe('waiting')
  expect(vacant.querySelector<HTMLInputElement>('[aria-label="12번 캐릭터 이름"]')?.disabled).toBe(
    false
  )
  expect(vacant.querySelector('[aria-label="12번 서버"]')).not.toBeNull()
})

it('자리 배치대로 슬롯을 그리고 조회는 그 자리에 놓인 검색 슬롯 번호로 알린다', async () => {
  const lookup = vi.fn()
  const seatOrder = swapSeats(createSeatOrder(RAID_SEAT_LAYOUT), 0, 5)
  await render({
    characters: [member],
    seatOrder,
    lookupSlot: lookup
  })

  expect(nameOf(seats()[5])).toBe('공대원')
  expect(seats()[5].textContent).toContain('Y2')
  expect(nameOf(seats()[0])).toBe('')
  const firstSeat = seats()[0]
  const input = await enterName(firstSeat, '첫자리')
  const select = firstSeat.querySelector('select')!
  await act(async () => {
    select.value = 'siroco'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(lookup).toHaveBeenCalledExactlyOnceWith(5, '첫자리', 'siroco')
  await enterName(firstSeat, '다시조회')
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  )
  expect(lookup).toHaveBeenLastCalledWith(5, '다시조회', 'siroco')
})

it('맞바꾸면 카드가 입력 중인 이름과 함께 다른 파티의 자리로 옮겨 간다', async () => {
  await render({ characters: [member] })
  await enterName(seats()[3], '넷째초안')

  await render({
    characters: [member],
    seatOrder: swapSeats(createSeatOrder(RAID_SEAT_LAYOUT), 3, 4)
  })

  expect(nameOf(seats()[4])).toBe('넷째초안')
  expect(seats()[4].querySelector('[aria-label="5번 캐릭터 이름"]')).not.toBeNull()
  expect(nameOf(seats()[3])).toBe('')
})

it('카드에 포커스한 채 Alt와 방향키로 이웃 자리와 맞바꾸고 옮긴 카드에 포커스를 되돌린다', async () => {
  const swap = vi.fn(() => true)
  await render({ characters: [member], swapSeats: swap })
  const first = seats()[0]
  await act(async () => first.focus())

  await pressAlt(first, 'ArrowRight')
  expect(swap).toHaveBeenCalledExactlyOnceWith(0, 1)
  expect(container.querySelector('section > [role="status"]')?.textContent).toBe(
    '1번 자리와 2번 자리를 맞바꿨습니다.'
  )
  // Chromium은 React가 옮긴 카드 노드의 포커스를 잃지만 jsdom은 그대로 두므로, 다시 그리기 전에 잃은 상태를 만든다.
  await act(async () => first.blur())
  await render({
    characters: [member],
    swapSeats: swap,
    seatOrder: swapSeats(createSeatOrder(RAID_SEAT_LAYOUT), 0, 1)
  })
  expect(document.activeElement).toBe(seats()[1])
  expect(nameOf(seats()[1])).toBe('공대원')

  await pressAlt(seats()[1], 'ArrowDown')
  expect(swap).toHaveBeenLastCalledWith(1, 5)
  swap.mockClear()
  await pressAlt(seats()[0], 'ArrowLeft')
  await pressAlt(seats()[0], 'ArrowUp')
  await pressAlt(seats()[11], 'ArrowRight')
  await pressAlt(seats()[11], 'ArrowDown')
  await pressAlt(seats()[2], 'ArrowRight', false)
  await pressAlt(seats()[2].querySelector('input')!, 'ArrowRight')
  expect(swap).not.toHaveBeenCalled()
})

it('카드를 다른 카드에 드래그해 놓으면 두 자리를 맞바꾸고 이름 칸 글자를 드래그하는 동작은 자리를 옮기지 않는다', async () => {
  const swap = vi.fn(() => true)
  await render({ characters: [member], swapSeats: swap })

  const start = await drag('dragstart', seats()[1])
  expect(start.setData).toHaveBeenCalledWith(SEAT_DRAG_TYPE, '2')
  await drag('dragover', seats()[4])
  expect(seats()[4].className).not.toBe(seats()[3].className)
  await drag('drop', seats()[4])
  expect(swap).toHaveBeenCalledExactlyOnceWith(1, 4)
  expect(seats()[4].className).toBe(seats()[3].className)

  swap.mockClear()
  await drag('dragstart', seats()[2].querySelector('input')!)
  await drag('dragover', seats()[6])
  await drag('drop', seats()[6])
  expect(swap).not.toHaveBeenCalled()
})

it('맞바꿀 수 없는 동안은 드래그와 Alt 방향키를 받지 않고 자리 이름에서 옮기기 안내를 뺀다', async () => {
  const swap = vi.fn(() => true)
  await render({ characters: [member], swapSeats: swap, canMoveSeats: false })

  const first = seats()[0]
  expect(first.getAttribute('aria-label')).toBe('1번 자리')
  expect(first.getAttribute('draggable')).toBe('false')
  expect(first.getAttribute('aria-keyshortcuts')).toBeNull()
  await pressAlt(first, 'ArrowRight')
  await drag('dragstart', seats()[1])
  await drag('dragover', seats()[4])
  await drag('drop', seats()[4])
  expect(swap).not.toHaveBeenCalled()
})

it('드래그하던 카드가 회차나 배치 변경으로 다시 그려지면 dragend 없이도 드래그를 끝내고 흐린 표시와 놓기를 거둔다', async () => {
  const swap = vi.fn(() => true)
  const idleClass = (): string => seats()[2].className
  await render({ characters: [member], swapSeats: swap })

  await drag('dragstart', seats()[1])
  expect(seats()[1].className).not.toBe(idleClass())
  await render({ characters: [member], swapSeats: swap, resetKey: 'next-round' })
  expect(seats()[1].className).toBe(idleClass())
  await drag('dragover', seats()[4])
  await drag('drop', seats()[4])
  expect(swap).not.toHaveBeenCalled()

  await drag('dragstart', seats()[1])
  await render({
    characters: [member],
    swapSeats: swap,
    resetKey: 'next-round',
    seatOrder: swapSeats(createSeatOrder(RAID_SEAT_LAYOUT), 6, 7)
  })
  expect(seats()[1].className).toBe(idleClass())
  await drag('drop', seats()[4])
  expect(swap).not.toHaveBeenCalled()
})

it('드래그하는 동안 맞바꿀 수 없게 되면 드래그를 끝내 다시 맞바꿀 수 있게 돼도 그 드래그로는 놓지 않는다', async () => {
  const swap = vi.fn(() => true)
  await render({ characters: [member], swapSeats: swap })

  await drag('dragstart', seats()[1])
  await render({ characters: [member], swapSeats: swap, canMoveSeats: false })
  await render({ characters: [member], swapSeats: swap })
  await drag('dragover', seats()[4])
  await drag('drop', seats()[4])
  expect(swap).not.toHaveBeenCalled()
})

it('자리 드래그 형식이 없는 드래그는 자리 드래그 중이어도 드롭 대상으로 받지 않는다', async () => {
  const swap = vi.fn(() => true)
  await render({ characters: [member], swapSeats: swap })

  await drag('dragstart', seats()[1])
  const over = await drag('dragover', seats()[4], ['text/plain'])
  const drop = await drag('drop', seats()[4], ['text/plain'])
  expect(over.event.defaultPrevented).toBe(false)
  expect(drop.event.defaultPrevented).toBe(false)
  expect(swap).not.toHaveBeenCalled()
})

it('맞바꾸기를 거절하면 알리지 않고, 다음 배치 변경에서 그 카드로 포커스를 가져가지 않는다', async () => {
  const swap = vi.fn(() => false)
  await render({ characters: [member], swapSeats: swap })
  await act(async () => seats()[0].focus())

  await pressAlt(seats()[0], 'ArrowRight')
  expect(swap).toHaveBeenCalledExactlyOnceWith(0, 1)
  expect(moveNotices()).toEqual(['', ''])

  const outsideButton = document.createElement('button')
  container.after(outsideButton)
  try {
    await act(async () => outsideButton.focus())
    await render({
      characters: [member],
      swapSeats: swap,
      seatOrder: swapSeats(createSeatOrder(RAID_SEAT_LAYOUT), 0, 1)
    })
    expect(document.activeElement).toBe(outsideButton)
  } finally {
    outsideButton.remove()
  }
})

it('같은 두 자리를 연달아 맞바꿔도 알림 영역을 번갈아 채워 다시 읽히게 한다', async () => {
  await render({ characters: [member] })
  const text = '1번 자리와 2번 자리를 맞바꿨습니다.'

  await pressAlt(seats()[0], 'ArrowRight')
  const first = moveNotices()
  expect(first.filter((notice) => notice === text)).toHaveLength(1)
  expect(first.filter((notice) => notice === '')).toHaveLength(1)
  await pressAlt(seats()[0], 'ArrowRight')
  const second = moveNotices()
  expect(second.filter((notice) => notice === text)).toHaveLength(1)
  expect(second.indexOf(text)).not.toBe(first.indexOf(text))
})

it('조회 중, 실패, 결과 0건은 자리마다 따로 보이고 실패 안내는 소속 줄 자리에 보인다', async () => {
  const slots = [...idle]
  slots[0] = 'success'
  slots[4] = 'pending'
  slots[7] = 'failure'
  slots[11] = 'empty'
  const notices: (string | undefined)[] = Array.from({ length: 12 }, () => undefined)
  notices[7] = '검색 시간이 초과됐습니다.'
  await render({ characters: [member], slots, slotNotices: notices })

  const card = (index: number): HTMLElement => seats()[index].querySelector('article')!
  expect(card(4).getAttribute('aria-busy')).toBe('true')
  expect(card(4).querySelector('[aria-label="5번 캐릭터 확인 중"]')).not.toBeNull()
  expect(card(7).getAttribute('data-state')).toBe('failure')
  expect(card(7).querySelector('[aria-label="검색 실패"]')).not.toBeNull()
  expect(card(7).querySelector('p')?.textContent).toBe('검색 시간이 초과됐습니다.')
  expect(card(11).getAttribute('data-state')).toBe('failure')
  expect(card(11).querySelector('p')?.textContent).toBe('검색 결과가 없습니다')
  expect(card(0).getAttribute('aria-busy')).toBe('false')
})

it('이름 칸에 들어가거나 고치는 동안은 선택 상태만 보이고 진행 표시는 조회하는 동안에만 보인다', async () => {
  const lookup = vi.fn()
  await render({ characters: [member], lookupSlot: lookup })
  const card = (): HTMLElement => seats()[0].querySelector('article')!
  const progress = (): Element | null => card().querySelector('[aria-label="1번 캐릭터 확인 중"]')
  const marks = (): Element[] => [
    ...card().querySelectorAll('[role="img"]:not([aria-label$="이미지 없음"])')
  ]
  const input = seats()[0].querySelector('input')!
  await act(async () => input.focus())
  expect(card().getAttribute('data-state')).toBe('selected')
  expect(marks()).toEqual([])
  expect(progress()).toBeNull()
  expect(card().getAttribute('aria-busy')).toBe('false')

  await enterName(seats()[0], '고친이름')
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  )
  expect(lookup).toHaveBeenCalledOnce()
  const slots = [...idle]
  slots[0] = 'pending'
  await render({ slots, lookupSlot: lookup })
  expect(progress()).not.toBeNull()
  expect(card().getAttribute('aria-busy')).toBe('true')
  expect(marks()).toEqual([])
})

it('찾은 카드의 안내는 소속 줄을 지키며 보조 기술에만 전하고 명성과 장비 점수 라벨을 둔다', async () => {
  const notices: (string | undefined)[] = Array.from({ length: 12 }, () => undefined)
  notices[1] = '장비 점수로 추정한 후보입니다.'
  await render({
    characters: [member, member],
    slots: ['success', 'success', ...idle.slice(2)],
    slotNotices: notices
  })

  const card = (index: number): HTMLElement => seats()[index].querySelector('article')!
  expect(card(0).textContent).not.toContain('추정한 후보')
  const affiliation = card(1).querySelector<HTMLElement>(
    '[title="장비 점수로 추정한 후보입니다."]'
  )!
  expect(affiliation.title).toBe('장비 점수로 추정한 후보입니다.')
  expect(affiliation.textContent).toContain('공대모험단')
  expect(card(1).querySelector('p')).toBeNull()
  for (const index of [0, 1]) {
    expect([...card(index).querySelectorAll('dt')].map((term) => term.textContent)).toEqual([
      '명성',
      '장비'
    ])
  }
})

it('공대 카드의 장비 점수는 카드 값에서 오고 계산값이나 계산하지 못한 사유를 보조 기술에 전한다', async () => {
  await render({
    characters: [
      member,
      {
        ...member,
        card: {
          ...member.card!,
          score: {
            ...dealerCard.score!,
            value: null,
            skipped: { kind: 'unresolved', message: 'unresolved: equipment TITLE missing' }
          }
        }
      }
    ]
  })
  const scoreOf = (seat: HTMLElement): Element =>
    [...seat.querySelectorAll('dt')].find((term) => term.textContent === '장비')!
      .nextElementSibling!

  expect(scoreOf(seats()[0]).textContent).toContain('330,556')
  expect(scoreOf(seats()[0]).textContent).toContain('던삐삐 계산값')
  expect(scoreOf(seats()[1]).textContent).toBe('-계산하지 못함, 장비 정보 부족')
})

it('공대 카드는 엔진이 낸 근사값을 ≈를 붙여 보이고 근사값이라는 뜻을 보조 기술에 전한다', async () => {
  const approximateScore = {
    ...dealerCard.score!,
    value: null,
    skipped: { kind: 'unresolved', message: 'unresolved: equipment TITLE missing' },
    approximate: {
      value: 321000,
      source: 'legacy_fusion_policy_a',
      warning: '근사값, 1% 밖일 가능성 높음: unresolved: equipment TITLE missing'
    }
  }
  await render({ characters: [{ ...member, card: { ...member.card!, score: approximateScore } }] })
  const score = [...seats()[0].querySelectorAll('dt')].find((term) => term.textContent === '장비')!
    .nextElementSibling!

  expect(score.textContent).toContain('≈321,000')
  expect(score.getAttribute('title')).toBe(
    '근사값, 장비 정보 부족. 이전 시즌 융합석을 빼고 계산한 값이라 게임 장비 점수와 1% 넘게 다를 수 있습니다.'
  )
  expect(seats()[0].textContent).not.toContain('TITLE')
})

it('공대 카드의 점수 라벨과 색은 역할을 따르고 상위, 랭커 단계 카드는 명성과 점수에 단계 색을 칠한다', async () => {
  const termValue = (seat: HTMLElement, label: string): Element | undefined => {
    const term = [...seat.querySelectorAll('dt')].find((item) => item.textContent === label)
    if (term == null) {
      return undefined
    }

    return term.nextElementSibling!
  }
  const dealer = { ...member, card: dealerCard }
  await render({
    characters: [
      dealer,
      { ...member, card: bufferCard },
      member,
      { ...member, card: bufferCard, tier: 'top' },
      { ...dealer, tier: 'ranker' },
      { ...member, card: { ...bufferCard, score: null } }
    ]
  })
  const [dealerSeat, bufferSeat, unknownSeat, topSeat, rankerSeat, missingSeat] = seats()

  expect(toneClassesOf(termValue(dealerSeat, '장비')!)).toEqual(['dealer'])
  expect(termValue(bufferSeat, '장비')).toBeUndefined()
  expect(termValue(bufferSeat, '버프')!.textContent).toContain('게임 버프 점수')
  expect(toneClassesOf(termValue(bufferSeat, '버프')!)).toEqual(['buffer'])
  expect(toneClassesOf(termValue(unknownSeat, '장비')!)).toEqual([])
  expect(toneClassesOf(termValue(topSeat, '명성')!)).toEqual(['top'])
  expect(toneClassesOf(termValue(topSeat, '버프')!)).toEqual(['top'])
  expect(toneClassesOf(termValue(rankerSeat, '명성')!)).toEqual(['ranker'])
  expect(toneClassesOf(termValue(rankerSeat, '장비')!)).toEqual(['ranker'])
  expect(termValue(missingSeat, '버프')!.textContent).toBe('-')
  expect(toneClassesOf(termValue(missingSeat, '버프')!)).toEqual([])
})

it('검색 응답에 없는 길드, 명성, 장비 점수는 -로 보인다', async () => {
  await render({
    characters: [{ ...member, guild: null, card: null, fame: null }]
  })
  const first = seats()[0]
  expect([...first.querySelectorAll('dd')].map((value) => value.textContent)).toEqual(['-', '-'])
  expect(first.textContent).toContain('공대모험단-')
})

it('스냅샷 순번 칩은 스냅샷 자리를 파티 색 글자와 파티 안 순번으로 보이고 그 파티 색 면에 옐로만 어두운 글자를 둔다', async () => {
  await render({
    characters: [member, member, member],
    snapshotMarks: [
      { kind: 'moved', seat: 4 },
      { kind: 'moved', seat: 5 },
      { kind: 'moved', seat: 12 },
      ...Array(9).fill(undefined)
    ]
  })

  const chips = seats()
    .slice(0, 3)
    .map((seat) => seat.querySelector('[aria-label^="스냅샷 순번"]')!)
  expect(chips.map((chip) => [chip.getAttribute('aria-label'), chip.textContent])).toEqual([
    ['스냅샷 순번 R4', 'R4'],
    ['스냅샷 순번 Y1', 'Y1'],
    ['스냅샷 순번 G4', 'G4']
  ])
  const fills = [expectedPartyFill.red, expectedPartyFill.yellow, expectedPartyFill.green]
  for (const [index, chip] of chips.entries()) {
    expect([...chip.classList]).toEqual(expect.arrayContaining(classesOf(fills[index])))
  }
})

it('보드는 창 폭을 네 등분한 열에 간격 8로 카드를 놓고 넘치면 보드 영역이 스크롤한다', async () => {
  await render({ characters: [member] })
  const scroller = container.querySelector('section')!.firstElementChild!
  const board = scroller.firstElementChild!
  const classes = (element: Element): string[] => element.className.split(' ')

  for (const name of classesOf(expectedLayout.scroll)) {
    expect(classes(scroller)).toContain(name)
  }
  for (const name of [...classesOf(expectedLayout.columns), ...classesOf(expectedLayout.gap)]) {
    expect(classes(board)).toContain(name)
  }
  expect(board.querySelectorAll('article')).toHaveLength(12)
  expect([...board.querySelectorAll(':scope > span')].map((label) => label.textContent)).toEqual([
    '1파티',
    '2파티',
    '3파티'
  ])
})

it('슬롯에 붙은 스냅샷 표시는 그 슬롯이 놓인 자리 카드에 칩과 경고로 들어간다', async () => {
  const seatOrder = swapSeats(createSeatOrder(RAID_SEAT_LAYOUT), 0, 1)
  await render({
    characters: [member, { ...member, adventure: '둘째모험단' }],
    seatOrder,
    snapshotMarks: [{ kind: 'absent' }, { kind: 'moved', seat: 2 }, ...Array(10).fill(undefined)]
  })

  const [first, second, third] = seats()
  expect(first.querySelector('[aria-label="스냅샷 순번 R2"]')).not.toBeNull()
  expect(first.querySelector('[aria-label="스냅샷에 없는 모험단"]')).toBeNull()
  expect(second.querySelector('[aria-label="스냅샷에 없는 모험단"]')).not.toBeNull()
  expect(third.querySelector('[aria-label^="스냅샷"]')).toBeNull()
  expect(container.querySelectorAll('[aria-label^="스냅샷 순번"]')).toHaveLength(1)
})

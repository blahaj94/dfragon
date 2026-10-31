// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PartyPage } from './PartyPage'
import { PARTY_SEAT_LAYOUT } from '../../constants/cards'
import type { SnapshotMark } from '../../lib/adventure-snapshot'
import { createSeatOrder, swapSeats, type SeatOrder } from '../../lib/seats'
import type { CardCharacter, SlotState } from '../../types/cards'

const CHARACTER_NAME_INPUT_SELECTOR = 'input[aria-label$="번 캐릭터 이름"]'

function statText(scope: Element, label: string): string | null {
  const term = [...scope.querySelectorAll('dt')].find((item) => item.textContent === label)
  const value = term?.nextElementSibling
  const shown = value?.querySelector('[aria-hidden="true"]') ?? value

  if (shown == null) {
    return null
  }

  return shown.textContent
}

let root: Root
let container: HTMLDivElement
const character: CardCharacter = {
  characterId: 'matched-id',
  name: '선택된이름',
  serverId: 'cain',
  adventure: '모험단',
  job: '직업',
  level: 115,
  fame: 0,
  card: null,
  image: 'https://img-api.neople.co.kr/df/servers/cain/characters/matched-id?zoom=1'
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

type RenderProps = Partial<Omit<ComponentProps<typeof PartyPage>, 'slots' | 'seats'>> & {
  slots: SlotState[]
  characters?: (CardCharacter | null)[]
  nicknames?: (string | null)[]
  snapshotMarks?: (SnapshotMark | undefined)[]
  snapshotAdventureInputs?: (string | undefined)[]
  seatOrder?: SeatOrder
  canMoveSeats?: boolean
  swapSeats?: (from: number, to: number) => boolean
}

async function render({
  slots,
  characters,
  nicknames,
  snapshotMarks,
  snapshotAdventureInputs,
  seatOrder = createSeatOrder(PARTY_SEAT_LAYOUT),
  canMoveSeats = true,
  swapSeats: swap = vi.fn(() => true),
  ...props
}: RenderProps): Promise<void> {
  const cards = slots.map((state, index) => {
    const character = characters?.[index] ?? undefined
    const nickname = nicknames?.[index] ?? undefined

    return {
      state,
      character,
      nickname,
      snapshotMark: snapshotMarks?.[index],
      snapshotAdventureInput: snapshotAdventureInputs?.[index]
    }
  })
  await act(async () =>
    root.render(
      <PartyPage
        resetKey="party"
        actions={{ lookupSlot: vi.fn(), pickCandidate: vi.fn(), changeSnapshotAdventure: vi.fn() }}
        {...props}
        seats={{ layout: PARTY_SEAT_LAYOUT, seatOrder, canMoveSeats, swapSeats: swap }}
        slots={cards}
      />
    )
  )
}

it('비동기 식별 성공은 OCR 첫 이름 대신 선택된 이름과 서버를 표시한다', async () => {
  await render({
    slots: ['pending', 'idle', 'idle', 'idle'],
    nicknames: ['OCR첫후보']
  })
  expect(container.querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)?.value).toBe(
    'OCR첫후보'
  )
  await render({
    slots: ['success', 'idle', 'idle', 'idle'],
    characters: [character],
    nicknames: ['OCR첫후보']
  })

  const slot = container.querySelector('article')!
  expect(slot.querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)?.value).toBe(
    '선택된이름'
  )
  expect(slot.textContent).toContain('카인')
  expect(statText(slot, '명성')).toBe('0')
  expect(statText(slot, '장비')).toBe('-')
  expect(slot.getAttribute('data-state')).toBe('default')
  expect(slot.querySelector('img')?.getAttribute('src')).toBe(character.image)
  expect(slot.querySelector('[role="tab"]')).toBeNull()
  expect(slot.querySelector('[aria-label="1번 캐릭터 상세 열기"]')).toBeNull()
})

it('네 슬롯의 서로 다른 선택과 대기 상태를 독립적으로 표시한다', async () => {
  await render({
    slots: ['success', 'success', 'pending', 'idle'],
    characters: [
      character,
      { ...character, characterId: 'another-id', name: '다른이름', fame: null },
      null,
      null
    ],
    nicknames: [null, null, '검색중', null]
  })
  const slots = container.querySelectorAll('article')
  expect(slots[0].querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)?.value).toBe(
    '선택된이름'
  )
  expect(slots[1].querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)?.value).toBe(
    '다른이름'
  )
  expect(statText(slots[1], '명성')).toBe('-')
  expect(slots[2].getAttribute('aria-busy')).toBe('true')
  expect(slots[3].getAttribute('aria-busy')).not.toBe('true')
  expect([...slots].map((slot) => slot.getAttribute('data-state'))).toEqual([
    'default',
    'default',
    'default',
    'waiting'
  ])
  expect(slots[2].querySelector('img')).toBeNull()
  expect(slots[3].querySelector('img')).toBeNull()
  expect(slots[2].querySelector('[aria-label="3번 캐릭터 상세 열기"]')).toBeNull()
  expect(slots[2].querySelector('[role="tablist"]')).toBeNull()
})

it('슬롯 번호대로 스냅샷 표시를 그 슬롯의 카드에 전한다', async () => {
  await render({
    slots: ['success', 'success', 'success', 'idle'],
    characters: [character, character, character],
    snapshotMarks: [undefined, { kind: 'moved', seat: 1 }, { kind: 'absent' }]
  })

  const slots = [...container.querySelectorAll('article')]
  expect(
    slots.map((slot) =>
      slot.querySelector('[role="img"][aria-label^="스냅샷"]')?.getAttribute('aria-label')
    )
  ).toEqual([undefined, '스냅샷 순번 1', '스냅샷에 없는 모험단', undefined])
})

function seats(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[aria-label*="번 자리"]')]
}

function nameOf(seat: HTMLElement): string | undefined {
  return seat.querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)?.value
}

async function pressAlt(target: HTMLElement, key: string): Promise<void> {
  await act(async () =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, altKey: true, bubbles: true }))
  )
}

// jsdom에는 DragEvent가 없어 React가 읽는 dataTransfer만 붙인 이벤트로 드래그를 흉내 낸다.
async function drag(type: string, target: HTMLElement, types: string[]): Promise<Event> {
  const dataTransfer = { types, setData: vi.fn(), effectAllowed: '', dropEffect: '' }
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  await act(async () => target.dispatchEvent(event))

  return event
}

it('파티 카드를 다른 카드에 끌어 놓으면 두 자리를 맞바꾼다', async () => {
  const swap = vi.fn(() => true)
  await render({
    slots: ['success', 'idle', 'idle', 'idle'],
    characters: [character],
    swapSeats: swap
  })
  const [first, , third] = seats()
  expect(first.getAttribute('draggable')).toBe('true')

  await drag('dragstart', first, [])
  await drag('dragover', third, ['application/x-dfragon-seat'])
  await drag('drop', third, ['application/x-dfragon-seat'])

  expect(swap).toHaveBeenCalledExactlyOnceWith(0, 2)
  expect(container.querySelector('section > [role="status"]')?.textContent).toBe(
    '1번 자리와 3번 자리를 맞바꿨습니다.'
  )
})

it('이름 칸을 고치는 동안은 그 파티 카드를 끌 수 없다', async () => {
  await render({ slots: ['idle', 'idle', 'idle', 'idle'] })
  const [first, second] = seats()
  const input = first.querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)!

  await act(async () => input.focus())
  expect(first.getAttribute('draggable')).toBe('false')
  expect(second.getAttribute('draggable')).toBe('true')

  await act(async () => input.blur())
  expect(first.getAttribute('draggable')).toBe('true')
})

it('파티 카드는 Alt와 왼쪽, 오른쪽 방향키로만 옆 자리와 맞바꾼다', async () => {
  const swap = vi.fn(() => true)
  await render({ slots: ['idle', 'idle', 'idle', 'idle'], swapSeats: swap })
  const hint = document.getElementById(seats()[1].getAttribute('aria-describedby')!)
  expect(hint?.textContent).toBe('Alt와 방향키로 왼쪽, 오른쪽 자리와 맞바꿉니다.')
  expect(seats()[1].getAttribute('aria-keyshortcuts')).toBe('Alt+ArrowLeft Alt+ArrowRight')

  await pressAlt(seats()[1], 'ArrowUp')
  await pressAlt(seats()[1], 'ArrowDown')
  await pressAlt(seats()[0], 'ArrowLeft')
  await pressAlt(seats()[3], 'ArrowRight')
  expect(swap).not.toHaveBeenCalled()

  await pressAlt(seats()[1], 'ArrowRight')
  expect(swap).toHaveBeenCalledExactlyOnceWith(1, 2)
})

it('자리 배치대로 카드를 그리고 조회는 그 자리에 놓인 검색 슬롯 번호로 알린다', async () => {
  const lookupSlot = vi.fn()
  await render({
    slots: ['success', 'idle', 'idle', 'idle'],
    characters: [character],
    seatOrder: swapSeats(createSeatOrder(PARTY_SEAT_LAYOUT), 0, 3),
    actions: { lookupSlot, pickCandidate: vi.fn(), changeSnapshotAdventure: vi.fn() }
  })

  expect(nameOf(seats()[3])).toBe('선택된이름')
  expect(seats()[3].querySelector('[aria-label="4번 캐릭터 이름"]')).not.toBeNull()
  expect(nameOf(seats()[0])).toBe('')
  const input = seats()[3].querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      input,
      '옮긴자리'
    )
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  )
  expect(lookupSlot).toHaveBeenCalledExactlyOnceWith(0, '옮긴자리', 'cain')
})

it('스냅샷 모험단 입력은 그 슬롯이 놓인 자리 카드에 열리고 바꾼 값을 자리 번호로 알린다', async () => {
  const changeSnapshotAdventure = vi.fn()
  await render({
    slots: ['failure', 'idle', 'idle', 'idle'],
    snapshotAdventureInputs: [''],
    seatOrder: swapSeats(createSeatOrder(PARTY_SEAT_LAYOUT), 0, 3),
    actions: { lookupSlot: vi.fn(), pickCandidate: vi.fn(), changeSnapshotAdventure }
  })

  const field = seats()[3].querySelector<HTMLInputElement>('input[aria-label="4번 모험단"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, '별빛')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(changeSnapshotAdventure).toHaveBeenCalledExactlyOnceWith(3, '별빛')
})

it('맞바꿀 수 없는 동안에는 파티 카드를 끌거나 옮길 수 없다', async () => {
  const swap = vi.fn(() => true)
  await render({ slots: ['idle', 'idle', 'idle', 'idle'], canMoveSeats: false, swapSeats: swap })

  expect(seats().map((seat) => seat.getAttribute('aria-label'))).toEqual([
    '1번 자리',
    '2번 자리',
    '3번 자리',
    '4번 자리'
  ])
  expect(seats()[0].getAttribute('draggable')).toBe('false')
  await pressAlt(seats()[0], 'ArrowRight')
  expect(swap).not.toHaveBeenCalled()
})

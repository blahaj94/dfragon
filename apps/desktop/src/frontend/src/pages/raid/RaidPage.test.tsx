// @vitest-environment jsdom
import * as stylex from '@stylexjs/stylex'
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ServerSelect } from '../../components/ServerSelect'
import { createSeatOrder, swapSeats } from '../../lib/raid-seats'
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
// jsdom은 배치를 계산하지 않으므로 보드가 창 크기와 상관없는 고정 트랙을 쓰는지 class로 확인한다.
const expectedLayout = stylex.create({
  columns: { gridTemplateColumns: '32px repeat(4, 288px)' },
  rows: { gridTemplateRows: 'repeat(3, calc(616px / 3))' },
  collapsedRows: { gridTemplateRows: 'repeat(3, calc(376px / 3))' },
  scroll: { overflow: 'auto' },
  hidden: { display: 'none' }
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
  equipmentScore: 414806,
  serverRank: 5000,
  equipment: [],
  oath: []
}
const idle: SlotState[] = Array.from({ length: 12 }, () => 'idle')

async function render(
  props: Partial<ComponentProps<typeof RaidPage>> & { characters?: (CardCharacter | null)[] } = {}
): Promise<void> {
  const characters = props.characters ?? []
  const slots = props.slots ?? idle.map((state, index) => (characters[index] ? 'success' : state))
  await act(async () =>
    root.render(
      <RaidPage
        id="raid-cards"
        notice=""
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        lastCapturedAt={null}
        canCapture
        onCapture={vi.fn()}
        seatOrder={createSeatOrder()}
        canMoveSeats
        onSwapSeats={vi.fn()}
        {...props}
        slots={slots}
        characters={characters}
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

// jsdom에는 DragEvent가 없어 React가 읽는 dataTransfer만 붙인 이벤트로 끌기를 흉내 낸다.
async function drag(type: string, target: HTMLElement): Promise<{ setData: () => void }> {
  const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' }
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  await act(async () => target.dispatchEvent(event))

  return dataTransfer
}

function classesOf(style: stylex.StyleXStyles): string[] {
  return (stylex.props(style).className ?? '').split(' ').filter(Boolean)
}

it('파티 라벨 열 옆에 세 파티 네 자리씩 12자리를 번호 순서로 놓고 찾은 자리 수를 머리에 보인다', async () => {
  await render({ characters: [member, { ...member, name: '둘째' }] })

  expect(container.querySelector('h1')?.textContent).toBe('공대')
  expect(container.textContent).toContain('2/12')
  expect(seats().map((seat) => seat.getAttribute('aria-label'))).toEqual(
    Array.from({ length: 12 }, (_, index) => `${index + 1}번 자리, 끌어서 옮기기`)
  )
  // 자리마다 속한 파티를 설명으로 전한다.
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
  expect(first.textContent).toContain('01')
  expect(first.textContent).toContain('공대모험단')
  expect(first.textContent).toContain('공대길드')
  expect(first.textContent).toContain('공대직업')
  expect(first.textContent).toContain('서버 순위 5000위')
  expect(first.querySelector('[aria-label="1번 캐릭터 상세 열기"]')).not.toBeNull()
  // 면 탭 없는 축약 카드다.
  expect(container.querySelector('[role="tab"]')).toBeNull()
  // 빈 자리도 이름 입력과 서버 선택부터 시작할 수 있다.
  const vacant = seats()[11]
  expect(vacant.querySelector('article')?.getAttribute('data-state')).toBe('waiting')
  expect(vacant.querySelector<HTMLInputElement>('[aria-label="12번 캐릭터 이름"]')?.disabled).toBe(
    false
  )
  expect(vacant.querySelector('[aria-label="12번 서버"]')).not.toBeNull()
})

it('찾은 카드의 스탯 한 줄은 응답에 스탯이 없으면 딜러 라벨에 -로, 합성 스탯은 역할별 라벨과 단위로 보인다', async () => {
  await render({
    characters: [
      member,
      {
        ...member,
        stats: {
          role: 'buffer',
          townIntelligence: 31420,
          buff30: 1284000,
          buff50: null,
          switchingLevel: 18
        }
      }
    ]
  })
  const statsOf = (seat: HTMLElement): string[] =>
    [...seat.querySelectorAll('dl')[0].querySelectorAll('div')].map((stat) => stat.textContent!)

  expect(statsOf(seats()[0])).toEqual(['공격력 증가-', '증폭-', '크리티컬-', '스위칭-'])
  expect(statsOf(seats()[1])).toEqual(['마을 지능31,420', '30레벨128.4만', '50레벨-', '스위칭18Lv'])
  // 찾지 못한 자리는 스탯 한 줄 없이 명성과 장비 점수만 둔다.
  expect([...seats()[2].querySelectorAll('dt')].map((term) => term.textContent)).toEqual([
    '명성',
    '장비 점수'
  ])
})

it('자리 배치대로 슬롯을 그리고 조회와 상세 열기는 그 자리에 놓인 검색 슬롯 번호로 알린다', async () => {
  const lookup = vi.fn()
  const detail = vi.fn()
  const seatOrder = swapSeats(createSeatOrder(), 0, 5)
  await render({
    characters: [member],
    seatOrder,
    onLookup: lookup,
    onSlotDetail: detail
  })

  // 슬롯 0의 캐릭터는 6번 자리에 번호 06으로 보이고 1번 자리에는 슬롯 5가 놓인다.
  expect(nameOf(seats()[5])).toBe('공대원')
  expect(seats()[5].textContent).toContain('06')
  expect(nameOf(seats()[0])).toBe('')
  await act(async () =>
    seats()[5].querySelector<HTMLButtonElement>('[aria-label="6번 캐릭터 상세 열기"]')!.click()
  )
  expect(detail).toHaveBeenCalledExactlyOnceWith(0)

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

  await render({ characters: [member], seatOrder: swapSeats(createSeatOrder(), 3, 4) })

  expect(nameOf(seats()[4])).toBe('넷째초안')
  expect(seats()[4].querySelector('[aria-label="5번 캐릭터 이름"]')).not.toBeNull()
  expect(nameOf(seats()[3])).toBe('')
})

it('카드에 포커스한 채 Alt와 방향키로 이웃 자리와 맞바꾸고 옮긴 카드에 포커스를 되돌린다', async () => {
  const swap = vi.fn()
  await render({ characters: [member], onSwapSeats: swap })
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
    onSwapSeats: swap,
    seatOrder: swapSeats(createSeatOrder(), 0, 1)
  })
  expect(document.activeElement).toBe(seats()[1])
  expect(nameOf(seats()[1])).toBe('공대원')

  await pressAlt(seats()[1], 'ArrowDown')
  expect(swap).toHaveBeenLastCalledWith(1, 5)
  // 보드 가장자리 밖, Alt 없는 방향키, 카드 안 입력의 방향키는 맞바꾸지 않는다.
  swap.mockClear()
  await pressAlt(seats()[0], 'ArrowLeft')
  await pressAlt(seats()[0], 'ArrowUp')
  await pressAlt(seats()[11], 'ArrowRight')
  await pressAlt(seats()[11], 'ArrowDown')
  await pressAlt(seats()[2], 'ArrowRight', false)
  await pressAlt(seats()[2].querySelector('input')!, 'ArrowRight')
  expect(swap).not.toHaveBeenCalled()
})

it('카드를 다른 카드에 끌어 놓으면 두 자리를 맞바꾸고 이름 칸 글자를 끄는 동작은 자리를 옮기지 않는다', async () => {
  const swap = vi.fn()
  await render({ characters: [member], onSwapSeats: swap })

  const transfer = await drag('dragstart', seats()[1])
  expect(transfer.setData).toHaveBeenCalledWith('application/x-dfragon-raid-seat', '2')
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

it('맞바꿀 수 없는 동안은 끌기와 Alt 방향키를 받지 않고 자리 이름에서 옮기기 안내를 뺀다', async () => {
  const swap = vi.fn()
  await render({ characters: [member], onSwapSeats: swap, canMoveSeats: false })

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

it('조회 중, 실패, 결과 0건은 자리마다 따로 보이고 실패 안내는 스탯 한 줄 자리에 보인다', async () => {
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
  expect(card(7).querySelector<HTMLButtonElement>('[aria-label$="상세 열기"]')?.disabled).toBe(true)
})

it('검색 응답에 없는 길드, 서버 순위, 명성, 장비 점수는 -로 보인다', async () => {
  await render({
    characters: [{ ...member, guild: null, serverRank: null, equipmentScore: null, fame: null }]
  })
  const first = seats()[0]
  const footer = [...first.querySelectorAll('dl')].at(-1)!
  expect([...footer.querySelectorAll('dd')].map((value) => value.textContent)).toEqual(['-', '-'])
  expect(first.textContent).toContain('서버 순위 없음')
  expect(first.textContent).toContain('공대모험단-')
})

it('머리에 안내, 비활성 스냅샷, 공대 캡처 버튼을 두고 접기 버튼이 보드 영역을 가리킨다', async () => {
  const toggle = vi.fn()
  await render({
    characters: [member],
    notice: '캐릭터 정보 창을 열지 못했습니다.',
    onToggleCollapsed: toggle
  })
  expect(container.querySelector('[role="status"]')?.textContent).toBe(
    '캐릭터 정보 창을 열지 못했습니다.'
  )
  expect(
    container.querySelector<HTMLButtonElement>('[aria-label="공대 모험단 순번 스냅샷"]')?.disabled
  ).toBe(true)
  expect(container.querySelector('[aria-label="공대 캡처, 단축키 Alt R"]')).not.toBeNull()
  const fold = container.querySelector<HTMLButtonElement>('[aria-label="카드 접기"]')!
  expect(fold.getAttribute('aria-controls')).toBe('raid-cards')
  expect(container.querySelectorAll('#raid-cards article')).toHaveLength(12)
  expect(fold.getAttribute('aria-expanded')).toBe('true')
  await act(async () => fold.click())
  expect(toggle).toHaveBeenCalledOnce()

  await render({ characters: [member], hidden: true })
  expect(container.querySelector('section')?.hidden).toBe(true)
})

it('보드는 창 크기와 상관없이 1280×800 배치의 카드 크기로 고정하고 넘치면 보드 영역이 스크롤한다', async () => {
  await render({ characters: [member] })
  const scroller = container.querySelector<HTMLElement>('#raid-cards')!
  const board = scroller.firstElementChild!
  const classes = (element: Element): string[] => element.className.split(' ')

  for (const name of classesOf(expectedLayout.scroll)) {
    expect(classes(scroller)).toContain(name)
  }
  for (const name of [...classesOf(expectedLayout.columns), ...classesOf(expectedLayout.rows)]) {
    expect(classes(board)).toContain(name)
  }

  await render({ characters: [member], collapsed: true })
  for (const name of [
    ...classesOf(expectedLayout.columns),
    ...classesOf(expectedLayout.collapsedRows)
  ]) {
    expect(classes(board)).toContain(name)
  }
})

it('접힌 동안은 그림 칸, 직업, 스탯 한 줄을 숨기고 이름 입력과 명성, 장비 점수를 남긴다', async () => {
  await render({ characters: [member] })
  const first = (): HTMLElement => seats()[0]
  const hiddenClasses = classesOf(expectedLayout.hidden)
  const hiddenParts = (): Element[] =>
    [...first().querySelectorAll('article *')].filter((element) =>
      hiddenClasses.every((name) => element.classList.contains(name))
    )
  expect(hiddenParts()).toEqual([])
  expect(first().querySelectorAll('dl')).toHaveLength(2)

  await render({ characters: [member], collapsed: true })
  expect(container.querySelector('[aria-label="카드 펼치기"]')?.getAttribute('aria-expanded')).toBe(
    'false'
  )
  expect(nameOf(first())).toBe('공대원')
  expect(first().querySelectorAll('dl')).toHaveLength(1)
  expect([...first().querySelectorAll('dt')].map((term) => term.textContent)).toEqual([
    '명성',
    '장비 점수'
  ])
  // 그림 칸(이미지가 없어 대체 표시 —)과 직업이 숨김 스타일을 받는다.
  expect(hiddenParts().map((element) => element.textContent)).toEqual(['—', '공대직업'])
})

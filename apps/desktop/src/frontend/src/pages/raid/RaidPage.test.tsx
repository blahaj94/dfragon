// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ServerSelect } from '../../components/ServerSelect'
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
        status=""
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        lastCapturedAt={null}
        canCapture
        onCapture={vi.fn()}
        basicOnly
        {...props}
        slots={slots}
        characters={characters}
      />
    )
  )
}

function cards(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('article')]
}

async function enterName(card: HTMLElement, value: string): Promise<HTMLInputElement> {
  const input = card.querySelector('input')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })

  return input
}

it('세 파티 네 명씩 12자리를 파티 카드와 같은 카드로 번호 순서대로 놓는다', async () => {
  await render({ characters: [member, { ...member, name: '둘째' }] })

  const groups = [...container.querySelectorAll('[role="group"]')]
  expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
    '1파티',
    '2파티',
    '3파티'
  ])
  expect(groups.map((group) => group.querySelectorAll('article').length)).toEqual([4, 4, 4])
  expect(cards().map((card) => card.getAttribute('aria-label'))).toEqual(
    Array.from({ length: 12 }, (_, index) => `${index + 1}번 슬롯`)
  )
  const first = cards()[0]
  expect(first.querySelector<HTMLInputElement>('input')?.value).toBe('공대원')
  expect(first.querySelector('[role="tab"]')).not.toBeNull()
  expect(first.querySelector('[aria-label="1번 캐릭터 상세 열기"]')).not.toBeNull()
  expect(first.textContent).toContain('서버 순위 5000위')
  expect(first.textContent).toContain('공대길드')
  // 빈 자리도 이름 입력과 서버 선택부터 시작할 수 있다.
  const vacant = cards()[11]
  expect(vacant.getAttribute('data-state')).toBe('waiting')
  expect(vacant.querySelector<HTMLInputElement>('input')?.disabled).toBe(false)
  expect(vacant.querySelector('[aria-label="12번 서버"]')).not.toBeNull()
})

it('빈 자리에서 이름을 넣고 서버를 고르면 그 자리 번호로 조회하고 다른 자리는 그대로 둔다', async () => {
  const lookup = vi.fn()
  await render({ characters: [member], onLookup: lookup })
  const tenth = cards()[9]
  const input = await enterName(tenth, '열번째')
  const select = tenth.querySelector('select')!
  await act(async () => {
    select.value = 'siroco'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(lookup).toHaveBeenCalledExactlyOnceWith(9, '열번째', 'siroco')
  await enterName(tenth, '다시조회')
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  )
  expect(lookup).toHaveBeenLastCalledWith(9, '다시조회', 'siroco')
  expect(cards()[0].querySelector<HTMLInputElement>('input')?.value).toBe('공대원')
  expect(cards()[8].querySelector<HTMLInputElement>('input')?.value).toBe('')
})

it('조회 중, 실패, 결과 0건은 자리마다 따로 보이고 상세 열기는 찾은 자리에서만 연다', async () => {
  const detail = vi.fn()
  const slots = [...idle]
  slots[0] = 'success'
  slots[4] = 'pending'
  slots[7] = 'failure'
  slots[11] = 'empty'
  const notices: (string | undefined)[] = Array.from({ length: 12 }, () => undefined)
  notices[7] = '검색 시간이 초과됐습니다.'
  notices[11] = '검색 결과가 없습니다.'
  await render({ characters: [member], slots, slotNotices: notices, onSlotDetail: detail })

  expect(cards()[4].getAttribute('aria-busy')).toBe('true')
  expect(cards()[4].querySelector('[aria-label="5번 캐릭터 확인 중"]')).not.toBeNull()
  expect(cards()[7].getAttribute('data-state')).toBe('failure')
  expect(cards()[7].textContent).toContain('검색 시간이 초과됐습니다.')
  expect(cards()[11].getAttribute('data-state')).toBe('failure')
  expect(cards()[11].textContent).toContain('검색 결과가 없습니다.')
  expect(cards()[0].getAttribute('aria-busy')).toBe('false')
  const failedDetail = cards()[7].querySelector<HTMLButtonElement>('[aria-label$="상세 열기"]')!
  expect(failedDetail.disabled).toBe(true)
  await act(async () =>
    cards()[0].querySelector<HTMLButtonElement>('[aria-label="1번 캐릭터 상세 열기"]')!.click()
  )
  expect(detail).toHaveBeenCalledExactlyOnceWith(0)
})

it('검색 응답에 없는 길드, 서버 순위, 장비 점수는 -로 보인다', async () => {
  await render({
    characters: [{ ...member, guild: null, serverRank: null, equipmentScore: null, fame: null }]
  })
  const first = cards()[0]
  expect([...first.querySelectorAll('dd')].map((value) => value.textContent)).toEqual(['-', '-'])
  expect(first.textContent).toContain('서버 순위 없음')
  expect(first.textContent).toContain('공대모험단-')
})

it('머리의 안내와 숨김 상태를 보이고 접기 버튼이 카드 영역을 가리킨다', async () => {
  const toggle = vi.fn()
  await render({
    characters: [member],
    status: '캐릭터 정보 창을 열지 못했습니다.',
    onToggleCollapsed: toggle
  })
  expect(container.querySelector('[role="status"]')?.textContent).toBe(
    '캐릭터 정보 창을 열지 못했습니다.'
  )
  const fold = container.querySelector<HTMLButtonElement>('[aria-label="카드 접기"]')!
  expect(fold.getAttribute('aria-controls')).toBe('raid-cards')
  expect(container.querySelector('#raid-cards [role="group"]')).not.toBeNull()
  expect(fold.getAttribute('aria-expanded')).toBe('true')
  await act(async () => fold.click())
  expect(toggle).toHaveBeenCalledOnce()

  await render({ characters: [member], hidden: true })
  expect(container.querySelector('section')?.hidden).toBe(true)
})

it('접힌 동안은 파티 카드에 접힘을 넘겨 이름 입력과 명성, 장비 점수 라벨을 남기고 면 탭을 접는다', async () => {
  await render({ characters: [member] })
  const facesClass = (): string | undefined =>
    cards()[0].querySelector('[role="tablist"]')?.parentElement?.className
  const expandedFaces = facesClass()
  await render({ characters: [member], collapsed: true })
  expect(container.querySelector('[aria-label="카드 펼치기"]')?.getAttribute('aria-expanded')).toBe(
    'false'
  )
  const first = cards()[0]
  expect(first.querySelector<HTMLInputElement>('input')?.value).toBe('공대원')
  expect([...first.querySelectorAll('dt')].map((term) => term.textContent)).toEqual([
    '명성',
    '장비 점수'
  ])
  // 면 탭은 파티 카드처럼 접힘 스타일로 숨긴다.
  expect(facesClass()).not.toBe(expandedFaces)
})

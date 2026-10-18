// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CardCharacter } from '../../types/cards'
import { RaidPage } from './RaidPage'

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
  job: '공대직업',
  serverId: 'cain',
  fame: 120000,
  serverRank: 5000,
  equipment: [],
  oath: []
}

async function render(
  characters: readonly (CardCharacter | null)[],
  collapsed = false,
  onToggleCollapsed = vi.fn()
): Promise<void> {
  await act(async () =>
    root.render(
      <RaidPage
        id="raid-cards"
        characters={characters}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
      />
    )
  )
}

function cards(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('article')]
}

// 화면에 그린 글자. 보조 기술에만 읽히는 숫자 최종값은 뺀다.
function drawnFame(card: HTMLElement): string | null | undefined {
  return card.querySelector('dd [aria-hidden="true"]')?.textContent
}

it('세 파티 네 명씩 12자리를 번호 순서로 놓고 비어 있는 자리는 대기 카드로 둔다', async () => {
  await render([member, { ...member, name: '둘째' }])

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
  expect(cards()[0].textContent).toContain('공대원')
  expect(cards()[0].textContent).toContain('카인')
  expect(cards()[0].textContent).toContain('서버 순위 5000위')
  expect(drawnFame(cards()[0])).toBe('120,000')
  expect(cards()[1].textContent).toContain('둘째')
  expect(cards()[2].getAttribute('data-state')).toBe('waiting')
  expect(cards()[2].textContent).toContain('비어 있음')
  expect(cards()[2].querySelector('dd')?.textContent).toBe('—')
})

it('상위, 랭커 공대원은 단계 꺾쇠 상태와 단계 이름을 보인다', async () => {
  await render([member, { ...member, tier: 'top' }, { ...member, tier: 'ranker' }])

  expect(cards()[0].getAttribute('data-state')).toBe('default')
  expect(cards()[1].getAttribute('data-state')).toBe('top')
  expect(cards()[1].textContent).toContain('상위 단계')
  expect(cards()[2].getAttribute('data-state')).toBe('ranker')
  expect(cards()[2].textContent).toContain('랭커 단계')
  expect(cards()[1].querySelector('dd')?.className).not.toBe(
    cards()[0].querySelector('dd')?.className
  )
})

it('접기 버튼이 카드 영역을 가리키고 접힌 동안은 번호, 이름, 명성 한 줄만 남긴다', async () => {
  const toggle = vi.fn()
  await render([member], false, toggle)
  const fold = container.querySelector<HTMLButtonElement>('[aria-label="카드 접기"]')!
  expect(fold.getAttribute('aria-controls')).toBe('raid-cards')
  expect(container.querySelector('#raid-cards [role="group"]')).not.toBeNull()
  expect(fold.getAttribute('aria-expanded')).toBe('true')
  await act(async () => fold.click())
  expect(toggle).toHaveBeenCalledOnce()

  await render([member], true, toggle)
  const unfold = container.querySelector('[aria-label="카드 펼치기"]')!
  expect(unfold.getAttribute('aria-expanded')).toBe('false')
  const first = cards()[0]
  expect(first.textContent).toContain('공대원')
  expect(first.textContent).toContain('명성')
  expect(first.textContent).toContain('120,000')
  expect(first.textContent).not.toContain('공대직업')
  expect(first.textContent).not.toContain('공대모험단')
  expect(first.textContent).not.toContain('카인')
  expect(first.textContent).not.toContain('서버 순위')
  expect(first.querySelector('dl')).toBeNull()
})

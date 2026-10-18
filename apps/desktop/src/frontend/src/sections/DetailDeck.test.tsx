// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CardCharacter } from '../types/cards'
import { DetailDeck } from './DetailDeck'

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

const character: CardCharacter = {
  name: '상세캐릭터',
  adventure: '상세모험단',
  job: '상세직업',
  serverId: 'cain',
  fame: 125850,
  card: null,
  equipment: [],
  oath: []
}

function selector(face: string): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>(`[aria-label="${face} 카드 선택"]`)!
}

it('캐릭터 정보와 점수를 두고 장비 카드를 앞에, 나머지 카드는 이름과 번호로 보인다', async () => {
  await act(async () => root.render(<DetailDeck character={character} />))

  expect(container.querySelector('h2')?.textContent).toBe('상세캐릭터')
  expect(container.querySelector('header')?.textContent).toContain('카인')
  expect(container.querySelector('header')?.textContent).not.toContain('\u00B7')
  const values = [...container.querySelectorAll('header dd')]
  expect(values[0].textContent).toBe('—')
  expect(values[1].querySelector('[aria-hidden="true"]')?.textContent).toBe('125,850')
  const sections = [...container.querySelectorAll('section')]
  expect(sections.map((section) => section.getAttribute('aria-label'))).toEqual([
    '장비 카드',
    '서약 카드',
    '강화 카드',
    '마법부여 카드',
    '스킬트리 카드'
  ])
  expect(selector('장비').getAttribute('aria-pressed')).toBe('true')
  expect(container.querySelector('h3')?.textContent).toBe('장비')
  expect(selector('서약').textContent).toBe('서약02')
})

it('뒤 카드를 누르면 그 카드가 앞으로 나와 내용을 보이고 이전 카드는 이름 띠로 돌아간다', async () => {
  await act(async () => root.render(<DetailDeck character={character} />))
  const place = (face: string) =>
    container.querySelector(`section[aria-label="${face} 카드"]`)?.getAttribute('style')
  const front = place('장비')
  const last = place('스킬트리')
  expect(front).not.toBe(last)

  await act(async () => selector('스킬트리').click())

  // 고른 카드가 앞 자리로 옮겨 오고 나머지는 한 자리씩 뒤로 밀린다.
  expect(place('스킬트리')).toBe(front)
  expect(place('장비')).not.toBe(front)
  expect(place('마법부여')).toBe(last)

  expect(selector('스킬트리').getAttribute('aria-pressed')).toBe('true')
  expect(selector('장비').getAttribute('aria-pressed')).toBe('false')
  expect(container.querySelector('h3')?.textContent).toBe('스킬트리')
  expect(container.textContent).toContain('구성 예정')
  expect(selector('장비').textContent).toBe('장비01')
})

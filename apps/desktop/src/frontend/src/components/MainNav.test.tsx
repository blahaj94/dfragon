// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useSearchModeStore } from '../hooks/useSearchModeStore'
import type { SearchMode } from '../types/search-mode'
import { MainNav } from './MainNav'

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

async function render(searchMode: SearchMode): Promise<void> {
  useSearchModeStore.setState({ searchMode })
  await act(async () => root.render(<MainNav />))
}

function trigger(): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!
}

function menuItems(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
}

async function key(target: Element, name: string): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
  })
}

it('주 메뉴는 현재 화면인 검색 하나와 현재 하위 이름만 보인다', async () => {
  await render('raid')
  const nav = container.querySelector('nav[aria-label="주 메뉴"]')!
  const buttons = [...nav.querySelectorAll('button')]

  expect(buttons.map((button) => button.textContent)).toEqual(['검색공대'])
  expect(trigger().getAttribute('aria-current')).toBe('page')
})

it('하위 메뉴는 파티와 공대 중 현재 항목을 표시하고 고르면 검색 모드를 바꾸고 닫힌다', async () => {
  await render('party')
  await act(async () => trigger().click())

  expect(document.querySelector('[role="menu"]')?.getAttribute('aria-label')).toBe('검색')
  expect(menuItems().map((item) => [item.textContent, item.getAttribute('aria-checked')])).toEqual([
    ['파티', 'true'],
    ['공대', 'false']
  ])
  await act(async () => menuItems()[1].click())

  expect(useSearchModeStore.getState().searchMode).toBe('raid')
  expect(trigger().textContent).toBe('검색공대')
  expect(document.querySelector('[role="menu"]')).toBeNull()
})

it('화살표로 항목을 옮기고 Escape로 닫으면 검색 버튼으로 포커스가 돌아온다', async () => {
  await render('party')
  trigger().focus()
  await key(trigger(), 'ArrowDown')
  const menu = document.querySelector('[role="menu"]')!
  expect(menu).not.toBeNull()
  // Base UI는 키보드로 연 메뉴의 첫 항목에 다음 frame에서 포커스를 옮긴다.
  await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('파티'))

  await key(document.activeElement!, 'ArrowDown')
  await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('공대'))
  await key(menu, 'Escape')

  expect(document.querySelector('[role="menu"]')).toBeNull()
  expect(document.activeElement).toBe(trigger())
  expect(useSearchModeStore.getState().searchMode).toBe('party')
})

// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Preview } from './Preview'

let root: Root
let container: HTMLDivElement

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<Preview />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it('미리보기는 앱 첫 줄의 상단 바와 그 아래 파티 콘텐츠를 표시한다', () => {
  const main = container.querySelector('main')!
  const header = main.firstElementChild!
  expect(header.tagName).toBe('HEADER')
  expect(header.textContent).toContain('DFragon')
  expect(header.textContent).toContain('창 감지됨')
  expect(header.querySelector('[aria-label^="화면 캡처"]')).not.toBeNull()
  expect(header.querySelector('[aria-label$="테마"]')).toBeNull()
  expect(header.querySelector('[aria-label="설정"]')).toBeNull()
  expect(header.textContent).not.toContain('로그인')
  const party = main.querySelector('[aria-label="파티 캐릭터"]')!
  expect(party).not.toBeNull()
  expect(party.closest('header')).toBeNull()
  expect(header.compareDocumentPosition(party) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(main.querySelectorAll('article')).toHaveLength(4)
})

it.each([
  ['recognizing', '인식 중', 'signal'],
  ['complete', '인식 완료', 'signal'],
  ['unavailable', '확인 필요', 'warning'],
  ['missing', '창 미감지', 'warning']
])('캡처 미리보기 %s를 상단 바와 모달에 함께 반영한다', async (state, label, tone) => {
  const selector = container.querySelector<HTMLSelectElement>('[aria-label="캡처 미리보기 상태"]')!
  await act(async () => {
    selector.value = state
    selector.dispatchEvent(new Event('change', { bubbles: true }))
  })
  const header = container.querySelector('header')!
  expect(header.querySelector(`[data-tone="${tone}"]`)?.textContent).toBe(label)
  expect(header.querySelector('[data-tone][role="status"]')).toBeNull()
  expect(
    header.querySelectorAll(
      '[role="status"]:not([data-capture-announcer], [data-clipboard-announcer])'
    )
  ).toHaveLength(0)
  await act(async () =>
    header.querySelector<HTMLButtonElement>('[aria-label^="화면 캡처"]')!.click()
  )
  const dialog = document.querySelector('[role="dialog"]')!
  expect(dialog.querySelector('[role="status"]')?.textContent).toBe(label)
})

it('모달에서 창을 고르면 미리보기 목록과 안내도 창 선택됨 상태를 표시한다', async () => {
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label^="화면 캡처"]')!.click()
  )
  const dialog = document.querySelector('[role="dialog"]')!
  const option = dialog.querySelector<HTMLInputElement>(
    'input[type="radio"][aria-label="던전앤파이터"]'
  )!
  expect(option).not.toBeNull()
  await act(async () => option.click())

  const selector = container.querySelector<HTMLSelectElement>('[aria-label="캡처 미리보기 상태"]')!
  expect(selector.value).toBe('selected')
  expect(selector.selectedOptions[0].textContent).toBe('캡처, 창 선택됨')
  expect(dialog.textContent).toContain('Alt+R을 눌러 파티를 인식해 주세요.')
  expect(dialog.querySelector('input[type="radio"]:checked')?.getAttribute('aria-label')).toBe(
    '던전앤파이터'
  )
})

it('미리보기 조작부는 제품 창 영역 밖, 창 아래에 둔다', () => {
  const main = container.querySelector('main')!
  const controls = container.querySelector('[aria-label="미리보기 상태"]')!
  expect(main.contains(controls)).toBe(false)
  expect(main.compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(main.querySelector('[aria-label="파티 캐릭터"]')).not.toBeNull()
})

it('파티와 공대를 오가면 보이는 화면만 그리고, 파티 카드 입력과 스냅샷은 남는다', async () => {
  const trigger = container.querySelector<HTMLButtonElement>('nav button[aria-haspopup="menu"]')!
  const chooseScreen = async (name: string): Promise<void> => {
    await act(async () => trigger.click())
    const item = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
      (candidate) => candidate.textContent === name
    )!
    await act(async () => item.click())
  }
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="파티 모험단 순번 스냅샷"]')!.click()
  )
  const input = container.querySelector<HTMLInputElement>('[aria-label="4번 캐릭터 이름"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '입력중')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })

  await chooseScreen('공대')
  expect(container.querySelector('[aria-label="파티 캐릭터"]')).toBeNull()
  expect(container.querySelector('section[aria-label="공대"]')).not.toBeNull()

  await chooseScreen('파티')
  expect(container.querySelector('section[aria-label="공대"]')).toBeNull()
  expect(container.querySelector<HTMLInputElement>('[aria-label="4번 캐릭터 이름"]')!.value).toBe(
    '입력중'
  )
  expect(
    container.querySelector('[aria-label="파티 모험단 순번 스냅샷"]')!.getAttribute('aria-pressed')
  ).toBe('true')
})

it('후보 고르기 미리보기에서 후보를 누르면 미리보기 중이 되고, 한 번 더 누르면 확정해 후보 창이 사라진다', async () => {
  const scenario = container.querySelector<HTMLSelectElement>('[aria-label="미리보기 상태"]')!
  await act(async () => {
    scenario.value = 'candidates'
    scenario.dispatchEvent(new Event('change', { bubbles: true }))
  })
  const firstCard = (): HTMLElement => container.querySelector('article')!
  const candidateWindow = (): Element | null =>
    container.querySelector('[role="group"][aria-label="1번 후보 고르기"]')
  const candidateTile = (server: string): HTMLButtonElement =>
    [...candidateWindow()!.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.getAttribute('aria-label')?.startsWith(server)
    )!
  expect(candidateTile('시로코').getAttribute('aria-pressed')).toBe('true')
  expect(candidateTile('카인').getAttribute('aria-pressed')).toBe('false')

  await act(async () => candidateTile('카인').click())
  expect(candidateTile('카인').getAttribute('aria-pressed')).toBe('true')
  expect(candidateTile('카인').getAttribute('aria-label')).toContain(
    '미리보기 중, 한 번 더 누르면 확정'
  )
  expect(firstCard().getAttribute('data-state')).toBe('selected')

  await act(async () => candidateTile('카인').click())
  expect(candidateWindow()).toBeNull()
  expect(firstCard().querySelector('[aria-label="후보 미리보기 중"]')).toBeNull()
})

// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ColorThemeProvider } from '../../components/ColorThemeProvider'
import { Preview } from './Preview'

let root: Root
let container: HTMLDivElement

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root.render(
      <ColorThemeProvider initialTheme="dark">
        <Preview />
      </ColorThemeProvider>
    )
  )
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
  expect(header.querySelector('[aria-label="화면 캡처"]')).not.toBeNull()
  expect(header.querySelector('[aria-label="라이트 테마"]')).not.toBeNull()
  expect(header.querySelector('[aria-label="설정"]')).not.toBeNull()
  const login = [...header.querySelectorAll('button')].find(
    (button) => button.textContent === '로그인'
  )!
  expect(login.disabled).toBe(true)
  const party = main.querySelector('[aria-label="파티 캐릭터"]')!
  expect(party).not.toBeNull()
  expect(party.closest('header')).toBeNull()
  expect(header.compareDocumentPosition(party) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(main.querySelectorAll('article')).toHaveLength(4)
})

it.each([
  ['recognizing', '인식 중', 'neutral'],
  ['complete', '인식 완료', 'neutral'],
  ['unavailable', '확인 필요', 'waiting'],
  ['missing', '창 미감지', 'waiting']
])('캡처 미리보기 %s를 상단 바와 모달에 함께 반영한다', async (state, label, tone) => {
  const selector = container.querySelector<HTMLSelectElement>('[aria-label="캡처 미리보기 상태"]')!
  await act(async () => {
    selector.value = state
    selector.dispatchEvent(new Event('change', { bubbles: true }))
  })
  const header = container.querySelector('header')!
  expect(header.querySelector(`[data-tone="${tone}"]`)?.textContent).toBe(label)
  expect(header.querySelector('[role="status"]')).toBeNull()
  await act(async () =>
    header.querySelector<HTMLButtonElement>('[aria-label="화면 캡처"]')!.click()
  )
  const dialog = document.querySelector('[role="dialog"]')!
  expect(dialog.querySelector('[role="status"]')?.textContent).toBe(label)
})

it('모달에서 창을 고르면 미리보기 목록과 안내도 창 선택됨 상태를 표시한다', async () => {
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="화면 캡처"]')!.click()
  )
  const dialog = document.querySelector('[role="dialog"]')!
  await act(async () =>
    dialog.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click()
  )
  const option = document.querySelector<HTMLElement>(
    '[role="menuitemradio"][aria-label="던전앤파이터"]'
  )!
  expect(option).not.toBeNull()
  await act(async () => option.click())

  const selector = container.querySelector<HTMLSelectElement>('[aria-label="캡처 미리보기 상태"]')!
  expect(selector.value).toBe('selected')
  expect(selector.selectedOptions[0].textContent).toBe('캡처 · 창 선택됨')
  expect(dialog.textContent).toContain('Alt+R을 눌러 파티를 인식해 주세요.')
  expect(dialog.querySelector('button[aria-haspopup="menu"]')?.textContent).toContain(
    '던전앤파이터'
  )
})

// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }))
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  delete document.documentElement.dataset.seedColorMode
  vi.unstubAllGlobals()
})

it('기본 앱은 샘플 데이터와 구버전 폼 없이 빈 카드 네 개로 시작한다', async () => {
  await act(async () => root.render(<App />))

  const slots = container.querySelectorAll('article')
  expect(slots).toHaveLength(4)
  for (const [index, slot] of [...slots].entries()) {
    expect(slot.getAttribute('aria-label')).toBe(`${index + 1}번 슬롯`)
    const input = slot.querySelector('input')!
    expect(input.value).toBe('')
    expect(input.disabled).toBe(true)
    expect(slot.querySelector('button')).toBeNull()
  }
  expect(container.querySelector('form')).toBeNull()
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('[aria-label="미리보기 상태"]')).toBeNull()
  expect(container.textContent).not.toContain('닉네임 수정')
  expect(container.textContent).toContain('검색·캡처 기능 준비 중')
  expect(
    container.querySelector<HTMLButtonElement>('[aria-label="캡처 연결 예정"]')!.disabled
  ).toBe(true)
  const login = [...container.querySelectorAll('button')].find(
    (button) => button.textContent === '로그인'
  )!
  expect(login.disabled).toBe(true)
})

it('새 기본 화면에서 다크·라이트 테마를 전환한다', async () => {
  await act(async () => root.render(<App />))
  expect(document.documentElement.dataset.seedColorMode).toBe('dark-only')

  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="라이트 테마"]')!.click()
  )
  expect(document.documentElement.dataset.seedColorMode).toBe('light-only')

  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="다크 테마"]')!.click()
  )
  expect(document.documentElement.dataset.seedColorMode).toBe('dark-only')
})

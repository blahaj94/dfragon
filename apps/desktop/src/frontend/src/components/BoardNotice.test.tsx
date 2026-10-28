// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BoardNotice } from './BoardNotice'

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

it('안내가 바뀌어도 같은 status 영역에 보이고 전체 문구를 title로 둔다', async () => {
  await act(async () => root.render(<BoardNotice />))
  const status = container.querySelector('[role="status"]')!
  expect(status.textContent).toBe('')
  const text = '검색 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
  await act(async () => root.render(<BoardNotice>{text}</BoardNotice>))
  expect(container.querySelector('[role="status"]')).toBe(status)
  expect(status.textContent).toBe(text)
  expect(status.getAttribute('title')).toBe(text)
})

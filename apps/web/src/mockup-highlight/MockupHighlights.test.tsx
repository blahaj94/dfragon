// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import HighlightedWindowMockup from '../WindowMockup'
import { HIGHLIGHT_TARGETS } from './highlight-targets'

let root: Root
let section: HTMLElement

beforeEach(async () => {
  vi.useFakeTimers()
  section = document.createElement('section')
  document.body.append(section)
  root = createRoot(section)
  await act(async () => root.render(<HighlightedWindowMockup />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  section.remove()
  vi.useRealTimers()
})

it('검색 메뉴, 스냅샷, 복사, 캡처 버튼을 실제 목업에서 찾는다', async () => {
  const mockup = section.firstElementChild as HTMLElement

  const [search, snapshot, copy, capture] = HIGHLIGHT_TARGETS.map((find) => find(mockup))

  expect(search?.textContent).toBe('검색파티')
  expect(snapshot?.getAttribute('aria-label')).toBe('파티 모험단 순번 스냅샷')
  expect(copy?.getAttribute('aria-label')).toBe('클립보드로 복사')
  expect(capture?.getAttribute('aria-label')).toBe('파티 캡처, 단축키 Alt R')
})

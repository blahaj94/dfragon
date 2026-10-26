// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ColorThemeProvider } from './ColorThemeProvider'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true }))
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  delete document.documentElement.dataset.theme
  document.documentElement.style.colorScheme = ''
  vi.unstubAllGlobals()
})

it('시스템 설정과 이전에 남은 라이트 테마와 관계없이 다크 테마와 color-scheme을 넣는다', async () => {
  document.documentElement.dataset.theme = 'light'
  document.documentElement.style.colorScheme = 'light'

  await act(async () =>
    root.render(
      <ColorThemeProvider>
        <span>화면</span>
      </ColorThemeProvider>
    )
  )

  expect(container.textContent).toBe('화면')
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(document.documentElement.style.colorScheme).toBe('dark')
})

it.each([undefined, 'light'] as const)(
  'Provider를 해제하면 기존 테마(%s)와 color-scheme을 복원한다',
  async (previousTheme) => {
    if (previousTheme != null) {
      document.documentElement.dataset.theme = previousTheme
      document.documentElement.style.colorScheme = previousTheme
    }
    await act(async () =>
      root.render(
        <ColorThemeProvider>
          <span>화면</span>
        </ColorThemeProvider>
      )
    )
    await act(async () => root.render(null))
    expect(document.documentElement.dataset.theme).toBe(previousTheme)
    expect(document.documentElement.style.colorScheme).toBe(previousTheme ?? '')
  }
)

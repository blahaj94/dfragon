// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createPortal } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ColorThemeProvider } from './ColorThemeProvider'
import { useColorTheme } from '../hooks/useColorTheme'

let container: HTMLDivElement
let portal: HTMLDivElement
let root: Root

function ThemeReader({ name }: { name: string }): React.JSX.Element {
  const { light, toggleTheme } = useColorTheme()
  return (
    <button aria-label={name} onClick={toggleTheme}>
      {light ? 'light' : 'dark'}
    </button>
  )
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }))
  )
  container = document.createElement('div')
  portal = document.createElement('div')
  document.body.append(container, portal)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  portal.remove()
  delete document.documentElement.dataset.seedColorMode
  vi.unstubAllGlobals()
})

it('중첩 화면과 body 포털의 소비자가 같은 테마를 읽고 어느 쪽에서도 함께 전환한다', async () => {
  await act(async () =>
    root.render(
      <StrictMode>
        <ColorThemeProvider>
          <div>
            <ThemeReader name="화면" />
          </div>
          {createPortal(<ThemeReader name="포털" />, portal)}
        </ColorThemeProvider>
      </StrictMode>
    )
  )
  expect(container.textContent).toBe('dark')
  expect(portal.textContent).toBe('dark')
  expect(document.documentElement.dataset.seedColorMode).toBe('dark-only')

  await act(async () => container.querySelector('button')!.click())
  expect(container.textContent).toBe('light')
  expect(portal.textContent).toBe('light')
  expect(document.documentElement.dataset.seedColorMode).toBe('light-only')

  await act(async () => portal.querySelector('button')!.click())
  expect(container.textContent).toBe('dark')
  expect(portal.textContent).toBe('dark')
  expect(document.documentElement.dataset.seedColorMode).toBe('dark-only')
})

it.each([
  { initialTheme: 'light', systemLight: false, expected: 'light' },
  { initialTheme: 'dark', systemLight: true, expected: 'dark' },
  { initialTheme: 'system', systemLight: true, expected: 'light' },
  { initialTheme: 'system', systemLight: false, expected: 'dark' }
] as const)(
  '$initialTheme 초기값과 시스템 설정($systemLight)으로 $expected 테마를 시작한다',
  async ({ initialTheme, systemLight, expected }) => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: systemLight } as MediaQueryList)
    await act(async () =>
      root.render(
        <ColorThemeProvider initialTheme={initialTheme}>
          <ThemeReader name="화면" />
        </ColorThemeProvider>
      )
    )
    expect(container.textContent).toBe(expected)
    expect(document.documentElement.dataset.seedColorMode).toBe(`${expected}-only`)
  }
)

it.each([undefined, 'system'] as const)(
  'Provider를 해제하면 기존 SEED 테마(%s)를 복원한다',
  async (previousMode) => {
    if (previousMode != null) {
      document.documentElement.dataset.seedColorMode = previousMode
    }
    await act(async () =>
      root.render(
        <ColorThemeProvider initialTheme="light">
          <ThemeReader name="화면" />
        </ColorThemeProvider>
      )
    )
    await act(async () => container.querySelector('button')!.click())
    await act(async () => root.render(null))
    expect(document.documentElement.dataset.seedColorMode).toBe(previousMode)
  }
)

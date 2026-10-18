// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'

// public/theme-init.js는 타입 선언이 없는 일반 script라 tsc 범위(src/frontend/src) 밖에서 검사한다.
async function loadThemeInitScript(): Promise<void> {
  vi.resetModules()
  await import('./public/theme-init.js')
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete document.documentElement.dataset.theme
  document.documentElement.style.colorScheme = ''
})

it.each([
  { systemLight: true, expected: 'light' },
  { systemLight: false, expected: 'dark' }
])(
  '시스템 라이트 설정($systemLight)으로 첫 페인트 전 $expected 테마와 color-scheme을 넣는다',
  async ({ systemLight, expected }) => {
    const matchMedia = vi.fn(() => ({ matches: systemLight }))
    vi.stubGlobal('matchMedia', matchMedia)

    await loadThemeInitScript()

    expect(matchMedia).toHaveBeenCalledExactlyOnceWith('(prefers-color-scheme: light)')
    expect(document.documentElement.dataset.theme).toBe(expected)
    expect(document.documentElement.style.colorScheme).toBe(expected)
  }
)

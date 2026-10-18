// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

// public/color-theme.js는 타입 선언이 없는 일반 script라 tsc 범위(src) 밖에서 검사한다.
const DARK_QUERY = '(prefers-color-scheme: dark)'

function stubSystemColorScheme(initialScheme: 'light' | 'dark') {
  const target = new EventTarget()
  const query = Object.assign(target, { matches: initialScheme === 'dark' })
  vi.stubGlobal('matchMedia', (media: string) => {
    expect(media).toBe(DARK_QUERY)

    return query
  })

  return (scheme: 'light' | 'dark') => {
    query.matches = scheme === 'dark'
    target.dispatchEvent(new Event('change'))
  }
}

async function loadColorThemeScript() {
  vi.resetModules()
  await import('../public/color-theme.js')
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete document.documentElement.dataset.theme
})

describe('색 모드 초기화', () => {
  it.each(['light', 'dark'] as const)(
    '시스템이 %s이면 같은 data-theme을 넣는다',
    async (scheme) => {
      stubSystemColorScheme(scheme)

      await loadColorThemeScript()

      expect(document.documentElement.dataset.theme).toBe(scheme)
    }
  )

  it('불러온 뒤 시스템 모드가 바뀌면 data-theme도 따라 바뀐다', async () => {
    const changeSystemScheme = stubSystemColorScheme('light')
    await loadColorThemeScript()

    changeSystemScheme('dark')

    expect(document.documentElement.dataset.theme).toBe('dark')

    changeSystemScheme('light')

    expect(document.documentElement.dataset.theme).toBe('light')
  })
})

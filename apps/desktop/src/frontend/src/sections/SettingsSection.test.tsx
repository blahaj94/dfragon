// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ColorThemeProvider } from '../components/ColorThemeProvider'
import { SettingsSection } from './SettingsSection'

vi.mock('virtual:dfragon-desktop-licenses', () => ({
  default: [
    {
      name: 'Example',
      version: '1.2.3',
      license: 'MIT',
      documents: [
        {
          name: 'LICENSE',
          text: 'Copyright Example\n<script>untrusted()</script>\nFull original text.'
        },
        { name: 'NOTICE', text: 'Additional attribution' }
      ]
    },
    {
      name: 'Needs original',
      version: '1.0.0',
      license: 'ISC · 원문 확인 필요',
      documents: [{ name: 'LICENSE-STATUS.txt', text: 'Original not available' }]
    }
  ]
}))

let root: ReturnType<typeof createRoot>

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root.render(
      <ColorThemeProvider initialTheme="dark">
        <SettingsSection />
      </ColorThemeProvider>
    )
  )
})

afterEach(async () => {
  await act(async () => root.unmount())
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

function button(label: string): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.getAttribute('aria-label') === label || button.textContent?.includes(label)
  )!
}

async function click(label: string): Promise<void> {
  await act(async () => button(label).click())
}

it('설정에서 전체 고지를 안전한 텍스트로 표시하고 목록 포커스를 복원한다', async () => {
  await click('설정')
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  expect(document.body.textContent).toContain('원문 확인 필요')
  await click('Example')
  expect(document.activeElement?.textContent).toBe('Example')
  expect([...document.querySelectorAll('pre')].map((element) => element.textContent)).toEqual([
    'Copyright Example\n<script>untrusted()</script>\nFull original text.',
    'Additional attribution'
  ])
  expect(document.querySelector('script')).toBeNull()
  await click('라이선스 목록')
  expect(document.activeElement).toBe(button('Example'))
  await click('닫기')
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  await click('설정')
  expect(document.querySelector('pre')).toBeNull()
  expect(document.body.textContent).toContain('2개 구성 요소')
})

it('검색 결과 없음과 Escape 닫기를 제공한다', async () => {
  await click('설정')
  const input = document.querySelector('input')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'absent')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(document.body.textContent).toContain('검색 결과가 없습니다')
  await act(async () => {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
  })
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

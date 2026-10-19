// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ColorThemeProvider } from '../components/ColorThemeProvider'
import { SettingsSection } from './SettingsSection'
import type { DeveloperModeState } from '../hooks/useDeveloperMode'

// 불러오기 실패 경로는 이 값을 켜서 데이터 읽기를 실패시킨다.
const licenseCatalog = vi.hoisted(() => ({ failing: false }))

vi.mock('virtual:dfragon-desktop-licenses', () => ({
  get default() {
    if (licenseCatalog.failing) {
      throw new Error('test catalog unavailable')
    }

    return catalogEntries
  }
}))

const catalogEntries = [
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
  licenseCatalog.failing = false
})

function button(label: string): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.getAttribute('aria-label') === label || button.textContent?.includes(label)
  )!
}

async function click(label: string): Promise<void> {
  await act(async () => button(label).click())
}

// Base UI Switch는 감싼 label을 aria-labelledby로 연결하므로 접근 가능한 이름으로 찾는다.
function developerSwitch(): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('[role="switch"]')].find((element) => {
    const labelId = element.getAttribute('aria-labelledby')

    return labelId != null && document.getElementById(labelId)?.textContent === '개발자 모드'
  })
}

async function renderSettings(props: ComponentProps<typeof SettingsSection>): Promise<void> {
  await act(async () =>
    root.render(
      <ColorThemeProvider initialTheme="dark">
        <SettingsSection {...props} />
      </ColorThemeProvider>
    )
  )
}

function readyMode(change: Partial<DeveloperModeState> = {}): DeveloperModeState {
  return {
    status: 'ready',
    enabled: false,
    updating: false,
    retry: vi.fn(),
    setEnabled: vi.fn(),
    ...change
  }
}

it('설정 대화상자는 두 메뉴와 메뉴 아래쪽 계정 버튼, 앱 이름을 두고 열린 동안 설정 버튼에 열림 속성을 붙인다', async () => {
  await renderSettings({ account: <button type="button">로그인</button> })
  const trigger = button('설정')
  expect(trigger.hasAttribute('data-popup-open')).toBe(false)
  await click('설정')
  const dialog = document.querySelector('[role="dialog"]')!
  expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('설정')
  expect(trigger.hasAttribute('data-popup-open')).toBe(true)
  const menu = dialog.querySelector('nav[aria-label="설정 메뉴"]')!
  expect([...menu.querySelectorAll('button')].map((element) => element.textContent)).toEqual([
    '라이선스 사용고지',
    '개발자 모드',
    '로그인'
  ])
  expect(menu.textContent).toContain('DFragon Desktop')
  expect(dialog.textContent).not.toContain('버전 정보')
  expect(dialog.textContent).not.toContain('앱 정보')
  await click('닫기')
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(trigger.hasAttribute('data-popup-open')).toBe(false)
})

it('설정에서 전체 고지를 안전한 텍스트로 표시하고 목록 포커스를 복원한다', async () => {
  await click('설정')
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  const list = document.querySelector('ul[aria-label="라이선스 사용고지"]')!
  expect([...list.querySelectorAll('button')].map((element) => element.textContent)).toEqual([
    'Example1.2.3MIT',
    'Needs original1.0.0ISC · 원문 확인 필요'
  ])
  expect(document.querySelector('input')).toBeNull()
  await click('Example')
  expect(document.activeElement?.textContent).toBe('Example')
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('MIT')
  expect([...document.querySelectorAll('pre')].map((element) => element.textContent)).toEqual([
    'Copyright Example\n<script>untrusted()</script>\nFull original text.',
    'Additional attribution'
  ])
  expect(document.querySelector('script')).toBeNull()
  const back = [...document.querySelectorAll<HTMLButtonElement>('section button')].find(
    (element) => element.textContent === '라이선스 사용고지'
  )!
  await act(async () => back.click())
  expect(document.activeElement).toBe(button('Example'))
  await click('닫기')
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  await click('설정')
  expect(document.querySelector('pre')).toBeNull()
  expect(document.querySelectorAll('ul[aria-label="라이선스 사용고지"] li')).toHaveLength(2)
})

it('Escape로 설정 대화상자를 닫는다', async () => {
  await click('설정')
  await act(async () => {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
  })
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it('라이선스가 기본 메뉴이며 개발 모드는 설명, 상태 글 없이 스위치로 설정한다', async () => {
  const openDeveloperWorkbench = vi.fn()
  const mode = readyMode()

  await renderSettings({ developerMode: mode, onOpenDeveloperWorkbench: openDeveloperWorkbench })
  await click('설정')
  expect(document.querySelector('[aria-current="page"]')?.textContent).toBe('라이선스 사용고지')
  await click('개발자 모드')
  expect(document.querySelector('[aria-current="page"]')?.textContent).toBe('개발자 모드')
  const content = document.querySelector('section[aria-label="개발자 모드"]')!
  expect(content.textContent).toBe('개발자 모드')
  expect(document.querySelector('[role="status"]')).toBeNull()
  expect(developerSwitch()?.getAttribute('aria-checked')).toBe('false')
  await act(async () => developerSwitch()!.click())
  expect(mode.setEnabled).toHaveBeenCalledExactlyOnceWith(true)
  expect(openDeveloperWorkbench).not.toHaveBeenCalled()

  await renderSettings({
    developerMode: { ...mode, enabled: true },
    onOpenDeveloperWorkbench: openDeveloperWorkbench
  })
  // 다시 렌더링해도 설정 dialog는 열린 채로 남는다. 열린 modal 뒤의 trigger는 누를 수 없다.
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  expect(developerSwitch()?.getAttribute('aria-checked')).toBe('true')
  expect(content.textContent).toBe('개발자 모드개발 도구 열기')
  await click('개발 도구 열기')
  expect(openDeveloperWorkbench).toHaveBeenCalledExactlyOnceWith()
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it('개발자 모드 설정을 저장하는 동안 스위치를 바꿀 수 없다', async () => {
  const mode = readyMode({ updating: true })
  await renderSettings({ developerMode: mode })
  await click('설정')
  await click('개발자 모드')
  expect(developerSwitch()?.getAttribute('aria-disabled')).toBe('true')
  expect(developerSwitch()?.getAttribute('aria-busy')).toBe('true')
  await act(async () => developerSwitch()!.click())
  expect(mode.setEnabled).not.toHaveBeenCalled()
})

it('preload API가 없으면 개발자 모드를 쓸 수 없는 이유만 한 줄로 보인다', async () => {
  await click('설정')
  await click('개발자 모드')
  expect(
    [...document.querySelectorAll('[role="status"]')].map((status) => status.textContent)
  ).toEqual(['!이 실행 환경에서는 개발자 모드를 사용할 수 없습니다.'])
  expect(document.querySelector('[role="switch"]')).toBeNull()
})

it('개발자 모드 설정을 불러오거나 저장하지 못하면 오류 한 줄과 다시 시도를 보인다', async () => {
  const mode: DeveloperModeState = { ...readyMode(), status: 'error' }
  await renderSettings({ developerMode: mode })
  await click('설정')
  await click('개발자 모드')
  const alert = document.querySelector('[role="alert"]')!
  expect(alert.querySelector('p')?.textContent).toBe(
    '!개발자 모드 설정을 불러오거나 저장하지 못했습니다.'
  )
  expect(document.querySelector('[role="switch"]')).toBeNull()
  await click('다시 시도')
  expect(mode.retry).toHaveBeenCalledExactlyOnceWith()
})

it('라이선스 정보를 불러오지 못하면 오류 한 줄과 다시 시도를 보이고 다시 시도로 목록을 연다', async () => {
  licenseCatalog.failing = true
  await click('설정')
  const alert = document.querySelector('[role="alert"]')!
  expect(alert.querySelector('p')?.textContent).toBe('!라이선스 정보를 불러오지 못했습니다.')
  expect(document.querySelector('ul[aria-label="라이선스 사용고지"]')).toBeNull()
  licenseCatalog.failing = false
  await click('다시 시도')
  expect(document.querySelector('[role="alert"]')).toBeNull()
  expect(document.querySelectorAll('ul[aria-label="라이선스 사용고지"] li')).toHaveLength(2)
})

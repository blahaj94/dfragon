// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ColorThemeProvider } from '../components/ColorThemeProvider'
import { SettingsSection } from './SettingsSection'
import type { DeveloperModeState } from '../hooks/useDeveloperMode'
import type { BuildVersions } from '../../../preload/common/types/build-versions'

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
  Reflect.deleteProperty(window, 'versions')
})

function button(label: string): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.getAttribute('aria-label') === label || button.textContent?.includes(label)
  )!
}

async function click(label: string): Promise<void> {
  await act(async () => button(label).click())
}

function developerSwitch(): HTMLInputElement | undefined {
  return [...document.querySelectorAll<HTMLInputElement>('input[role="switch"]')].find(
    (input) => input.labels?.[0]?.textContent === '개발자 모드'
  )
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

it('라이선스가 기본 메뉴이며 개발 모드는 명시적으로 설정할 수 있다', async () => {
  const setEnabled = vi.fn()
  const openDeveloperWorkbench = vi.fn()
  const mode: DeveloperModeState = {
    status: 'ready',
    enabled: false,
    updating: false,
    retry: vi.fn(),
    setEnabled
  }

  await act(async () =>
    root.render(
      <ColorThemeProvider initialTheme="dark">
        <SettingsSection developerMode={mode} onOpenDeveloperWorkbench={openDeveloperWorkbench} />
      </ColorThemeProvider>
    )
  )
  await click('설정')
  expect(document.querySelector('[aria-current="page"]')?.textContent).toContain('라이선스')
  await click('개발자 모드')
  expect(document.querySelector('[aria-current="page"]')?.textContent).toContain('개발자 모드')
  expect(document.body.textContent).toContain('개발자 모드 꺼짐')
  expect(developerSwitch()?.checked).toBe(false)
  expect(document.body.textContent).not.toContain('개발 도구 열기')
  await act(async () => developerSwitch()!.click())
  expect(setEnabled).toHaveBeenCalledExactlyOnceWith(true)
  expect(openDeveloperWorkbench).not.toHaveBeenCalled()

  await act(async () =>
    root.render(
      <ColorThemeProvider initialTheme="dark">
        <SettingsSection
          developerMode={{ ...mode, enabled: true }}
          onOpenDeveloperWorkbench={openDeveloperWorkbench}
        />
      </ColorThemeProvider>
    )
  )
  await click('설정')
  await click('개발자 모드')
  expect(developerSwitch()?.checked).toBe(true)
  await click('개발 도구 열기')
  expect(openDeveloperWorkbench).toHaveBeenCalledExactlyOnceWith()
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it('개발자 모드 설정을 저장하는 동안 스위치를 바꿀 수 없다', async () => {
  const setEnabled = vi.fn()
  await act(async () =>
    root.render(
      <ColorThemeProvider initialTheme="dark">
        <SettingsSection
          developerMode={{
            status: 'ready',
            enabled: false,
            updating: true,
            retry: vi.fn(),
            setEnabled
          }}
        />
      </ColorThemeProvider>
    )
  )
  await click('설정')
  await click('개발자 모드')
  expect(document.body.textContent).toContain('개발자 모드 설정 저장 중')
  expect(developerSwitch()?.disabled).toBe(true)
  await act(async () => developerSwitch()!.click())
  expect(setEnabled).not.toHaveBeenCalled()
})

it('shows the mode as unavailable when preload APIs are absent', async () => {
  await click('설정')
  await click('개발자 모드')
  expect(document.body.textContent).toContain(
    '이 실행 환경에서는 개발자 모드를 사용할 수 없습니다.'
  )
  expect(developerSwitch()).toBeUndefined()
})

it('shows full app and service commits with partial failures and refreshes the deployed versions', async () => {
  const initial: BuildVersions = {
    desktop: { version: '2.3.4', commit: 'a'.repeat(40), dirty: true },
    servers: {
      api: { status: 'available', commit: 'b'.repeat(40) },
      accounts: { status: 'unsupported' },
      ocr: { status: 'unavailable' }
    }
  }
  const getBuildVersions = vi
    .fn()
    .mockResolvedValueOnce(initial)
    .mockResolvedValueOnce({
      ...initial,
      servers: { ...initial.servers, accounts: { status: 'available', commit: null } }
    })
  Object.defineProperty(window, 'versions', { configurable: true, value: { getBuildVersions } })
  await click('설정')
  expect(getBuildVersions).not.toHaveBeenCalled()
  await click('버전 정보')
  expect(document.body.textContent).toContain('버전 2.3.4')
  expect(document.body.textContent).toContain('a'.repeat(40))
  expect(document.body.textContent).toContain('b'.repeat(40))
  expect(document.body.textContent).toContain('로컬 변경 포함')
  expect(document.body.textContent).toContain('계정 서버 (accounts)버전 조회 미지원')
  expect(document.body.textContent).toContain('OCR 서버연결 확인 필요')
  await click('새로고침')
  expect(getBuildVersions).toHaveBeenCalledTimes(2)
  expect(document.body.textContent).toContain('커밋 정보 없음 (개발 빌드)')
  expect(document.body.textContent).not.toContain('버전 조회 미지원')
})

it('keeps existing settings usable when the version bridge is absent', async () => {
  await click('설정')
  await click('버전 정보')
  expect(document.body.textContent).toContain('이 실행 환경에서는 버전 정보를 조회할 수 없습니다.')
  await click('라이선스 사용고지')
  expect(document.body.textContent).toContain('2개 구성 요소')
})

it('retains the previous snapshot with a clear warning when refresh fails', async () => {
  const getBuildVersions = vi
    .fn()
    .mockResolvedValueOnce({
      desktop: { version: '1.2.3', commit: null, dirty: null },
      servers: {
        api: { status: 'unsupported' },
        accounts: { status: 'unsupported' },
        ocr: { status: 'unsupported' }
      }
    })
    .mockRejectedValueOnce(new Error('private transport detail'))
  Object.defineProperty(window, 'versions', { configurable: true, value: { getBuildVersions } })
  await click('설정')
  await click('버전 정보')
  await click('새로고침')
  expect(document.body.textContent).toContain('아래 정보는 이전 조회 결과입니다.')
  expect(document.body.textContent).toContain('버전 1.2.3')
  expect(document.body.textContent).not.toContain('private transport detail')
})

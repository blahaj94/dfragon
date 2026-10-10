// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import brandIcon from '../../../../resources/brand.png'
import { ColorThemeProvider } from './ColorThemeProvider'
import { TopBar } from './TopBar'

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

async function render(props: Partial<ComponentProps<typeof TopBar>> = {}): Promise<void> {
  await act(async () =>
    root.render(
      <ColorThemeProvider initialTheme="dark">
        <TopBar
          captureStatus={{ label: '캡처 중', tone: 'informative' }}
          capture={<button aria-label="화면 캡처">카메라</button>}
          settings={<button aria-label="설정">설정</button>}
          showCapture
          {...props}
        />
      </ColorThemeProvider>
    )
  )
}

it('상단 바는 로고, 상태, 카메라, 테마, 로그인, 설정 순서로 표시한다', async () => {
  await render()
  const header = container.querySelector('header')!
  expect(container.querySelectorAll('header')).toHaveLength(1)
  const mark = header.querySelector('img')!
  expect(mark.getAttribute('src')).toBe(brandIcon)
  expect(mark.getAttribute('alt')).toBe('')
  expect([mark.width, mark.height]).toEqual([24, 24])
  const name = mark.nextElementSibling!
  expect(name.textContent).toBe('DFragon')
  const badge = header.querySelector('[class*="tone_informative"]')!
  const buttons = [...header.querySelectorAll('button')]
  expect(buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent)).toEqual([
    '화면 캡처',
    '라이트 테마',
    '로그인',
    '설정'
  ])
  const items = [name, badge, ...buttons]
  for (let index = 1; index < items.length; index++) {
    expect(
      items[index - 1].compareDocumentPosition(items[index]) & Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0)
  }
})

it.each([
  ['캡처 중', 'informative'],
  ['준비 중', 'neutral'],
  ['창 미감지', 'warning'],
  ['조회 실패', 'critical'],
  ['창 감지됨', 'positive']
] as const)('상태 %s와 tone %s를 live region 없이 표시한다', async (label, tone) => {
  await render({ captureStatus: { label, tone } })
  const header = container.querySelector('header')!
  const badge = header.querySelector(`[class*="tone_${tone}"]`)!
  expect(badge.textContent).toBe(label)
  expect(badge.getAttribute('role')).toBeNull()
  expect(header.querySelector('[role="status"], [aria-live]')).toBeNull()
})

it('테마를 전환하면 다음 테마의 버튼 이름이 바뀐다', async () => {
  await render()
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="라이트 테마"]')!.click()
  )
  expect(container.querySelector('[aria-label="라이트 테마"]')).toBeNull()
  expect(container.querySelector('[aria-label="다크 테마"]')).not.toBeNull()
  expect(document.documentElement.dataset.seedColorMode).toBe('light-only')
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="다크 테마"]')!.click()
  )
  expect(container.querySelector('[aria-label="다크 테마"]')).toBeNull()
  expect(container.querySelector('[aria-label="라이트 테마"]')).not.toBeNull()
  expect(document.documentElement.dataset.seedColorMode).toBe('dark-only')
})

it('계정을 생략하면 비활성 로그인 자리 버튼을 표시한다', async () => {
  await render({ account: undefined })
  const login = [...container.querySelectorAll('button')].find(
    (button) => button.textContent === '로그인'
  )!
  expect(login.disabled).toBe(true)
})

it('계정이 null이면 로그인 자리 버튼을 표시하지 않는다', async () => {
  await render({ account: null })
  expect(container.textContent).not.toContain('로그인')
  expect(container.querySelectorAll('button')).toHaveLength(3)
})

it('계정 요소를 넘기면 로그인 자리 대신 해당 요소를 표시한다', async () => {
  const login = vi.fn()
  await render({ account: <button onClick={login}>계정 연결</button> })
  const account = [...container.querySelectorAll('button')].find(
    (button) => button.textContent === '계정 연결'
  )!
  expect(container.textContent).not.toContain('로그인')
  await act(async () => account.click())
  expect(login).toHaveBeenCalledOnce()
})

it('계정 요소가 아무것도 그리지 않으면 빈 감싼 span을 남기지 않는다', async () => {
  function SignedIn(): null {
    return null
  }

  await render({ account: <SignedIn /> })
  const header = container.querySelector('header')!
  expect(header.querySelectorAll('span:empty:not([aria-hidden])')).toHaveLength(0)
  expect(container.textContent).not.toContain('로그인')
})

it('캡처를 숨기면 배지와 카메라만 사라지고 나머지 도구를 유지한다', async () => {
  await render({ showCapture: false })
  expect(container.textContent).not.toContain('캡처 중')
  expect(container.querySelector('[aria-label="화면 캡처"]')).toBeNull()
  expect(container.querySelector('img')?.nextElementSibling?.textContent).toBe('DFragon')
  expect(container.querySelector('[aria-label="라이트 테마"]')).not.toBeNull()
  expect(container.textContent).toContain('로그인')
  expect(container.querySelector('[aria-label="설정"]')).not.toBeNull()
})

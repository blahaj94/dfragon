// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
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
          nav={<nav aria-label="주 메뉴">내비</nav>}
          capture={
            <button aria-label="화면 캡처, 창 감지됨">
              <span data-tone="success">창 감지됨</span>
            </button>
          }
          settings={<button aria-label="설정">설정</button>}
          showCapture
          {...props}
        />
      </ColorThemeProvider>
    )
  )
}

function textOrLabel(element: Element): string | null {
  const label = element.getAttribute('aria-label')
  if (label != null) {
    return label
  }

  return element.textContent
}

it('상단 바는 로고, 내비, 게임 연결 상태, 테마, 로그인, 설정 순서로 표시하고 카메라 버튼은 없다', async () => {
  await render()
  const header = container.querySelector('header')!
  expect(container.querySelectorAll('header')).toHaveLength(1)
  expect(header.querySelector('img')).toBeNull()
  const name = [...header.querySelectorAll('span')].find((span) => span.textContent === 'DFragon')!
  expect(name).toBeDefined()
  const nav = header.querySelector('nav')!
  const status = header.querySelector('[data-tone]')!
  const buttons = [...header.querySelectorAll('button')]
  expect(buttons.map(textOrLabel)).toEqual([
    '화면 캡처, 창 감지됨',
    '라이트 테마',
    '로그인',
    '설정'
  ])
  expect(header.querySelector('kbd')).toBeNull()
  const items = [name, nav, status, ...buttons.slice(1)]
  for (let index = 1; index < items.length; index++) {
    expect(
      items[index - 1].compareDocumentPosition(items[index]) & Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0)
  }
})

it('테마를 전환하면 다음 테마의 버튼 이름이 바뀐다', async () => {
  await render()
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="라이트 테마"]')!.click()
  )
  expect(container.querySelector('[aria-label="라이트 테마"]')).toBeNull()
  expect(container.querySelector('[aria-label="다크 테마"]')).not.toBeNull()
  expect(document.documentElement.dataset.theme).toBe('light')
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="다크 테마"]')!.click()
  )
  expect(container.querySelector('[aria-label="다크 테마"]')).toBeNull()
  expect(container.querySelector('[aria-label="라이트 테마"]')).not.toBeNull()
  expect(document.documentElement.dataset.theme).toBe('dark')
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

it('캡처를 숨기면 상태 칩만 사라지고 나머지 도구를 유지한다', async () => {
  await render({ showCapture: false })
  expect(container.textContent).not.toContain('창 감지됨')
  expect(container.querySelector('[data-tone]')).toBeNull()
  expect(container.querySelector('[aria-label^="화면 캡처"]')).toBeNull()
  expect(container.textContent).toContain('DFragon')
  expect(container.querySelector('[aria-label="라이트 테마"]')).not.toBeNull()
  expect(container.textContent).toContain('로그인')
  expect(container.querySelector('[aria-label="설정"]')).not.toBeNull()
})

it('내비가 null이면 내비와 로고 옆 구분선을 그리지 않는다', async () => {
  await render({ nav: null, showCapture: false })
  const header = container.querySelector('header')!
  expect(header.querySelector('nav')).toBeNull()
  // 로고 바로 다음이 구분선 없이 도구 버튼 묶음이다.
  const brand = [...header.querySelectorAll('span')].find((span) => span.textContent === 'DFragon')!
    .parentElement!
  expect(brand.nextElementSibling?.querySelector('[aria-label="라이트 테마"]')).not.toBeNull()
})

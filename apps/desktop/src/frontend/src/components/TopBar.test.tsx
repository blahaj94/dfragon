// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
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
      <TopBar
        start={<nav aria-label="주 메뉴">내비</nav>}
        center={null}
        end={
          <button aria-label="화면 캡처, 창 감지됨">
            <span data-tone="success">창 감지됨</span>
          </button>
        }
        {...props}
      />
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

it('상단 바는 로고, 내비, 게임 연결 상태 순서로 표시하고 테마, 카메라, 설정, 로그인 버튼은 없다', async () => {
  await render()
  const header = container.querySelector('header')!
  expect(container.querySelectorAll('header')).toHaveLength(1)
  expect(header.querySelector('img')).toBeNull()
  const name = [...header.querySelectorAll('span')].find((span) => span.textContent === 'DFragon')!
  expect(name).toBeDefined()
  const nav = header.querySelector('nav')!
  const status = header.querySelector('[data-tone]')!
  const buttons = [...header.querySelectorAll('button')]
  expect(buttons.map(textOrLabel)).toEqual(['화면 캡처, 창 감지됨'])
  expect(header.querySelector('[aria-label$="테마"]')).toBeNull()
  expect(header.textContent).not.toContain('로그인')
  expect(header.querySelector('[aria-label="설정"]')).toBeNull()
  expect(header.querySelector('kbd')).toBeNull()
  const items = [name, nav, status]
  for (let index = 1; index < items.length; index++) {
    expect(
      items[index - 1].compareDocumentPosition(items[index]) & Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0)
  }
})

it('가운데 자리 내용은 내비와 게임 연결 상태 사이에 둔다', async () => {
  await render({ center: <div data-center="" /> })
  const header = container.querySelector('header')!
  const nav = header.querySelector('nav')!
  const center = header.querySelector('[data-center]')!
  const chip = header.querySelector('[aria-label="화면 캡처, 창 감지됨"]')!
  expect(nav.compareDocumentPosition(center) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(center.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
})

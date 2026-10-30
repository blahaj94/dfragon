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
        grade={85}
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

it('상단 바는 등급, 이름, 내비, 게임 연결 상태 순서로 표시하고 로고, 테마, 카메라, 설정, 로그인 버튼은 없다', async () => {
  await render()
  const header = container.querySelector('header')!
  expect(container.querySelectorAll('header')).toHaveLength(1)
  expect(header.querySelector('img')).toBeNull()
  const grade = header.querySelector('[role="img"]')!
  const name = [...header.querySelectorAll('span')].find((span) => span.textContent === '던삐삐')!
  expect(name).toBeDefined()
  const nav = header.querySelector('nav')!
  const status = header.querySelector('[data-tone]')!
  const buttons = [...header.querySelectorAll('button')]
  expect(buttons.map(textOrLabel)).toEqual(['화면 캡처, 창 감지됨'])
  expect(header.querySelector('[aria-label$="테마"]')).toBeNull()
  expect(header.textContent).not.toContain('로그인')
  expect(header.querySelector('[aria-label="설정"]')).toBeNull()
  expect(header.querySelector('kbd')).toBeNull()
  const items = [grade, name, nav, status]
  for (let index = 1; index < items.length; index++) {
    expect(
      items[index - 1].compareDocumentPosition(items[index]) & Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0)
  }
})

it('가운데 슬롯 내용은 내비와 게임 연결 상태 사이에 둔다', async () => {
  await render({ center: <div data-center="" /> })
  const header = container.querySelector('header')!
  const nav = header.querySelector('nav')!
  const center = header.querySelector('[data-center]')!
  const chip = header.querySelector('[aria-label="화면 캡처, 창 감지됨"]')!
  expect(nav.compareDocumentPosition(center) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(center.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
})

it('등급 퍼센트를 숫자와 희귀도 이름으로 보조 기술에 알린다', async () => {
  await render({ grade: 85 })
  const grade = container.querySelector('header [role="img"]')!

  expect(grade.textContent).toBe('85%')
  expect(grade.getAttribute('aria-label')).toBe('등급 85퍼센트, 언커먼')

  await render({ grade: 97 })

  expect(grade.textContent).toBe('97%')
  expect(grade.getAttribute('aria-label')).toBe('등급 97퍼센트, 태초')
})

it('등급을 받지 못하면 퍼센트 자리를 -%로 비우고 이름은 그대로 둔다', async () => {
  await render({ grade: null })
  const header = container.querySelector('header')!
  const grade = header.querySelector('[role="img"]')!

  expect(grade.textContent).toBe('-%')
  expect(grade.getAttribute('aria-label')).toBe('등급 정보 없음')
  expect(header.textContent).toContain('던삐삐')
})

// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  try {
    await act(async () => root.unmount())
  } finally {
    container.remove()
  }
})

async function renderApp() {
  await act(async () => root.render(<App />))
}

function counterButton(): HTMLButtonElement {
  const button = container.querySelector('button')
  if (button == null) {
    throw new Error('카운터 버튼이 렌더링되지 않았습니다')
  }

  return button
}

describe('카운터 화면', () => {
  it('주 영역 안에서 사용할 수 있고 포커스를 받는 native 버튼을 제공한다', async () => {
    await renderApp()
    const mainRegions = container.querySelectorAll('main, [role="main"]')
    const button = counterButton()

    expect(mainRegions).toHaveLength(1)
    expect(mainRegions[0].contains(button)).toBe(true)
    expect([null, 'button']).toContain(button.getAttribute('role'))
    expect(button.type).toBe('button')
    expect(button.disabled).toBe(false)
    expect(button.getAttribute('aria-disabled')).not.toBe('true')
    expect(button.tabIndex).toBeGreaterThanOrEqual(0)
    expect(button.closest('[hidden], [inert], [aria-hidden="true"]')).toBeNull()

    button.focus()

    expect(document.activeElement).toBe(button)
  })

  it('버튼을 활성화할 때마다 표시되는 카운트가 하나씩 증가한다', async () => {
    await renderApp()
    const button = counterButton()
    expect(button.textContent).toBe('Count is 0')

    await act(async () => button.click())

    expect(button.textContent).toBe('Count is 1')

    await act(async () => button.click())

    expect(button.textContent).toBe('Count is 2')
  })

  it('이전 화면을 제거하고 다시 열면 카운트는 0에서 시작한다', async () => {
    await renderApp()
    const previousButton = counterButton()
    await act(async () => previousButton.click())
    expect(previousButton.textContent).toBe('Count is 1')

    await act(async () => root.render(null))

    expect(previousButton.isConnected).toBe(false)
    expect(container.childElementCount).toBe(0)

    await renderApp()
    const nextButton = counterButton()

    expect(nextButton.textContent).toBe('Count is 0')

    await act(async () => nextButton.click())

    expect(nextButton.textContent).toBe('Count is 1')
  })
})

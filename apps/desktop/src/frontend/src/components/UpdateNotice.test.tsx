// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { UpdateNotice } from './UpdateNotice'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {
        return
      }
      unobserve(): void {
        return
      }
      disconnect(): void {
        return
      }
    }
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function render(props: Partial<ComponentProps<typeof UpdateNotice>> = {}): Promise<void> {
  await act(async () =>
    root.render(
      <UpdateNotice tag="v1.2.0" onOpenRelease={() => {}} onDismiss={() => {}} {...props} />
    )
  )
}

function chip(): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>('button')!
}

function menuItems(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
}

it('새 버전을 알리는 칩 하나만 보이고 메뉴는 누르기 전까지 닫혀 있다', async () => {
  await render()
  expect(container.querySelector('[role="status"]')?.textContent).toBe('새 버전 v1.2.0')
  expect(container.querySelectorAll('button')).toHaveLength(1)
  expect(chip().textContent).toBe('새 버전 v1.2.0')
  expect(chip().getAttribute('aria-haspopup')).toBe('menu')
  expect(menuItems()).toEqual([])
})

it('칩을 누르면 Release 열기와 닫기 메뉴가 뜨고 Release 열기는 Release만 연다', async () => {
  const onOpenRelease = vi.fn()
  const onDismiss = vi.fn()
  await render({ onOpenRelease, onDismiss })

  await act(async () => chip().click())
  expect(menuItems().map((item) => item.textContent)).toEqual(['Release 열기', '닫기'])

  await act(async () => menuItems()[0].click())
  expect(onOpenRelease).toHaveBeenCalledOnce()
  expect(onDismiss).not.toHaveBeenCalled()
})

it('메뉴의 닫기는 알림 닫기만 요청한다', async () => {
  const onOpenRelease = vi.fn()
  const onDismiss = vi.fn()
  await render({ onOpenRelease, onDismiss })

  await act(async () => chip().click())
  await act(async () => menuItems()[1].click())
  expect(onDismiss).toHaveBeenCalledOnce()
  expect(onOpenRelease).not.toHaveBeenCalled()
})

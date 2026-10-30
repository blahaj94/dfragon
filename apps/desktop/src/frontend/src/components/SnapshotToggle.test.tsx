// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SnapshotToggle } from './SnapshotToggle'

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

async function render(props: Partial<ComponentProps<typeof SnapshotToggle>> = {}): Promise<void> {
  await act(async () =>
    root.render(
      <SnapshotToggle
        label="파티 모험단 순번 스냅샷"
        active={false}
        onTake={() => {}}
        onClear={() => {}}
        {...props}
      />
    )
  )
}

function toggle(): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>('[aria-label="파티 모험단 순번 스냅샷"]')!
}

function confirm(): HTMLElement | null {
  return document.querySelector('[role="alertdialog"]')
}

function choice(name: string): HTMLButtonElement {
  return [...confirm()!.querySelectorAll('button')].find((button) => button.textContent === name)!
}

it('버튼 아이콘은 켜짐 여부와 관계없이 윤곽만 있는 핀이다', async () => {
  await render()
  expect(toggle().querySelector('svg')?.getAttribute('fill')).toBe('none')

  await render({ active: true })
  expect(toggle().querySelector('svg')?.getAttribute('fill')).toBe('none')
})

it('꺼진 버튼을 누르면 확인 없이 스냅샷을 켠다', async () => {
  const onTake = vi.fn()
  await render({ onTake })
  expect(toggle().getAttribute('aria-pressed')).toBe('false')

  await act(async () => toggle().click())

  expect(onTake).toHaveBeenCalledOnce()
  expect(confirm()).toBeNull()
})

it('켜진 버튼을 누르면 이름이 붙은 alertdialog로 고정을 취소할지 묻고 유지에 먼저 포커스한다', async () => {
  const onClear = vi.fn()
  const onTake = vi.fn()
  await render({ active: true, onTake, onClear })
  expect(toggle().getAttribute('aria-pressed')).toBe('true')

  await act(async () => toggle().click())

  const dialog = confirm()!
  expect(dialog.getAttribute('aria-labelledby')).not.toBeNull()
  expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe(
    '고정을 취소하시겠습니까?'
  )
  await vi.waitFor(() => expect(document.activeElement).toBe(choice('유지')))
  expect(onTake).not.toHaveBeenCalled()
  expect(onClear).not.toHaveBeenCalled()
})

it('유지는 스냅샷을 그대로 두고 팝오버만 닫는다', async () => {
  const onClear = vi.fn()
  await render({ active: true, onClear })
  await act(async () => toggle().click())

  await act(async () => choice('유지').click())

  await vi.waitFor(() => expect(confirm()).toBeNull())
  expect(onClear).not.toHaveBeenCalled()
  expect(toggle().getAttribute('aria-pressed')).toBe('true')
})

it('고정 취소는 스냅샷을 지우고 팝오버를 닫는다', async () => {
  const onClear = vi.fn()
  await render({ active: true, onClear })
  await act(async () => toggle().click())

  await act(async () => choice('고정 취소').click())

  expect(onClear).toHaveBeenCalledOnce()
  await vi.waitFor(() => expect(confirm()).toBeNull())
})

it('Escape는 스냅샷을 지우지 않고 팝오버를 닫는다', async () => {
  const onClear = vi.fn()
  await render({ active: true, onClear })
  await act(async () => toggle().click())

  await act(async () =>
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    )
  )

  await vi.waitFor(() => expect(confirm()).toBeNull())
  expect(onClear).not.toHaveBeenCalled()
  await vi.waitFor(() => expect(document.activeElement).toBe(toggle()))
})

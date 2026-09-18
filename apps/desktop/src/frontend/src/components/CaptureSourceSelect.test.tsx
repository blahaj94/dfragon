// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ColorThemeProvider } from './ColorThemeProvider'
import { CaptureControls, type CaptureControlsProps } from './CaptureControls'

let root: ReturnType<typeof createRoot>
let props: CaptureControlsProps

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }))
  )
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  props = {
    sources: [
      { id: 'other', name: '테스트 창' },
      { id: 'game', name: '던전앤파이터' }
    ],
    selectedSourceId: 'game',
    active: true,
    starting: false,
    loading: false,
    failed: false,
    ready: true,
    status: '',
    onSelect: vi.fn(),
    onRefresh: vi.fn(),
    onStop: vi.fn()
  }
})

afterEach(async () => {
  await act(async () => root.unmount())
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

async function render(): Promise<void> {
  await act(async () =>
    root.render(
      <ColorThemeProvider>
        <CaptureControls {...props} />
      </ColorThemeProvider>
    )
  )
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => element.click())
}

function trigger(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!
}

async function openDialog(): Promise<void> {
  await render()
  await click(document.querySelector<HTMLButtonElement>('button[aria-label="화면 캡처"]')!)
}

it('감지된 게임을 먼저 표시하고 선택 표시와 직접 선택을 연결한다', async () => {
  await openDialog()
  await click(trigger())
  const menu = document.querySelector('[role="menu"]')!
  expect(menu.closest('[role="dialog"]')).not.toBeNull()
  expect(menu.closest('[aria-hidden="true"]')).toBeNull()
  const items = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
  expect(items.map((item) => item.getAttribute('aria-label'))).toEqual([
    '던전앤파이터',
    '테스트 창'
  ])
  expect(items[0].getAttribute('aria-checked')).toBe('true')
  expect(items[1].getAttribute('aria-checked')).toBe('false')
  await click(items[1])
  expect(props.onSelect).toHaveBeenCalledExactlyOnceWith('other')
  expect(trigger().getAttribute('aria-expanded')).toBe('false')
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  expect(props.onStop).not.toHaveBeenCalled()
})

it('Escape는 목록만 닫고 모달과 캡처를 유지한다', async () => {
  await openDialog()
  await click(trigger())
  await act(async () => {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
  })
  expect(trigger().getAttribute('aria-expanded')).toBe('false')
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  expect(props.onSelect).not.toHaveBeenCalled()
  expect(props.onStop).not.toHaveBeenCalled()
})

it('조회 실패 시 이전 목록 선택을 막고 새로고침 명령만 실행한다', async () => {
  props.failed = true
  await openDialog()
  await click(trigger())
  expect(document.body.textContent).toContain('창 목록을 불러오지 못했어요')
  const stale = document.querySelector<HTMLElement>('[role="menuitemradio"]')!
  expect(stale.getAttribute('aria-disabled')).toBe('true')
  await click(stale)
  expect(props.onSelect).not.toHaveBeenCalled()
  const refresh = document.querySelector<HTMLElement>('[role="menuitem"]')!
  await act(async () =>
    refresh.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    )
  )
  expect(props.onRefresh).toHaveBeenCalledTimes(2)
  expect(props.onSelect).not.toHaveBeenCalled()
})

it('빈 목록·사라진 선택과 로딩·연결 미준비 상태를 처리한다', async () => {
  props.sources = []
  await openDialog()
  expect(trigger().textContent).toContain('선택한 창 · 목록에서 사라짐')
  await click(trigger())
  expect(document.body.textContent).toContain('던파 창을 찾지 못했어요')
  expect(document.querySelector('[role="menuitemradio"]')).toBeNull()
  await click(trigger())
  props.loading = true
  await render()
  expect(trigger().disabled).toBe(true)
  props.loading = false
  props.ready = false
  await render()
  expect(trigger().disabled).toBe(true)
  expect(props.onSelect).not.toHaveBeenCalled()
})

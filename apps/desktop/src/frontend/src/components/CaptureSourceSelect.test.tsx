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
    phase: 'complete',
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

function chip(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('button[aria-label^="화면 캡처"]')!
}

async function openDialog(): Promise<void> {
  await render()
  await click(chip())
}

it.each([
  ['complete', false, false, '인식 완료', 'neutral'],
  ['unavailable', false, false, '확인 필요', 'waiting'],
  ['idle', false, true, '조회 실패', 'danger'],
  ['idle', false, false, '창 감지됨', 'success']
] as const)(
  '게임 연결 상태 칩이 %s 단계(목록 조회 중 %s, 실패 %s)에서 %s를 tone %s로 보이는 대화상자 버튼이다',
  async (phase, loading, failed, label, tone) => {
    props.phase = phase
    props.loading = loading
    props.failed = failed
    await render()
    const button = chip()
    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('aria-label')).toBe(`화면 캡처, ${label}`)
    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
    const status = button.querySelector(`[data-tone="${tone}"]`)!
    expect(status.textContent).toBe(label)
    // 상단 바의 칩은 상태가 바뀔 때마다 읽지 않는다. 알림은 대화상자 안의 칩만 한다.
    expect(document.querySelector('[role="status"], [aria-live]')).toBeNull()
    expect(document.querySelector('kbd')).toBeNull()
  }
)

it('게임 연결 상태 칩으로 연 대화상자를 닫으면 포커스가 칩으로 돌아온다', async () => {
  await render()
  const button = chip()
  button.focus()
  await click(button)
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
  expect(dialog).not.toBeNull()
  expect(props.onRefresh).toHaveBeenCalledOnce()
  await act(async () => {
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
  await vi.waitFor(() => expect(document.activeElement).toBe(chip()))
  expect(props.onStop).not.toHaveBeenCalled()
})

it('자동 감지한 창은 선택 전에 표시하고 사용자 클릭 전에는 캡처를 시작하지 않는다', async () => {
  props.phase = 'idle'
  props.selectedSourceId = ''
  await openDialog()
  expect(trigger().textContent).toContain('던전앤파이터, 감지됨')
  const statuses = [...document.querySelectorAll('[role="dialog"] [role="status"]')]
  expect(statuses.map((status) => status.textContent)).toContain('창 감지됨')
  expect(document.body.textContent).not.toContain('캡처 중지')
  expect(props.onSelect).not.toHaveBeenCalled()
  await click(trigger())
  const gameOption = document.querySelector<HTMLElement>(
    '[role="menuitemradio"][aria-label="던전앤파이터"]'
  )!
  expect(gameOption.getAttribute('aria-checked')).toBe('false')
  await click(gameOption)
  expect(props.onSelect).toHaveBeenCalledExactlyOnceWith('game')
})

it('후보가 여러 개여도 임의로 선택하지 않고 발견한 개수를 표시한다', async () => {
  props.phase = 'idle'
  props.selectedSourceId = ''
  props.sources.push({ id: 'second-game', name: 'DNF' })
  await openDialog()
  expect(trigger().textContent).toContain('던파 창 2개 감지됨')
  expect(props.onSelect).not.toHaveBeenCalled()
})

it('감지된 게임을 먼저 표시하고 선택 표시와 직접 선택을 연결한다', async () => {
  await openDialog()
  await click(trigger())
  // 목록은 body portal에 그려지지만 모달이 바깥을 가리는 범위에 들지 않아 누를 수 있어야 한다.
  const menu = document.querySelector('[role="menu"]')!
  expect(menu.closest('[aria-hidden="true"], [inert]')).toBeNull()
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
  expect(document.body.textContent).toContain('창 목록을 불러오지 못했습니다')
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

it('빈 목록, 사라진 선택과 로딩, 연결 미준비 상태를 처리한다', async () => {
  props.sources = []
  await openDialog()
  expect(trigger().textContent).toContain('선택한 창, 목록에서 사라짐')
  await click(trigger())
  expect(document.body.textContent).toContain('던파 창 미감지')
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

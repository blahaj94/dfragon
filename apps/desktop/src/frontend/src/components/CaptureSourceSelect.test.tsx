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
    capture: {
      sources: [
        { id: 'other', name: '테스트 창' },
        { id: 'game', name: '던전앤파이터' }
      ],
      selectedSourceId: 'game',
      sourcesLoading: false,
      sourcesFailed: false,
      selectSource: vi.fn(),
      refreshSources: vi.fn(),
      stopCapture: vi.fn(),
      search: { ready: true }
    },
    phase: 'complete',
    status: ''
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

function dialog(): HTMLElement {
  return document.querySelector<HTMLElement>('[role="dialog"]')!
}

// 창 목록 안의 찾는 중 안내. 대화상자 머리의 상태 칩도 status 영역이라 목록 안에서 찾는다.
function searchingNotice(): HTMLElement {
  return document.querySelector<HTMLElement>('[role="menu"] [role="status"]')!
}

function announcer(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-capture-announcer]')!
}

function retryProgress(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-retry-progress]')
}

async function openDialog(): Promise<void> {
  await render()
  await click(chip())
}

it.each([
  ['complete', false, false, '인식 완료', 'signal'],
  ['unavailable', false, false, '확인 필요', 'warning'],
  ['idle', false, true, '조회 실패', 'danger'],
  ['idle', false, false, '창 감지됨', 'success']
] as const)(
  '게임 연결 상태 칩이 %s 단계(목록 조회 중 %s, 실패 %s)에서 %s를 tone %s로 보이는 대화상자 버튼이다',
  async (phase, loading, failed, label, tone) => {
    props.phase = phase
    props.capture.sourcesLoading = loading
    props.capture.sourcesFailed = failed
    await render()
    const button = chip()
    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('aria-label')).toBe(`화면 캡처, ${label}`)
    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
    const status = button.querySelector(`[data-tone="${tone}"]`)!
    expect(status.textContent).toBe(label)
    // 상단 바의 칩은 상태가 바뀔 때마다 읽지 않는다. 대화상자를 닫은 동안의 알림은 화면 밖 캡처
    // 안내 하나만 한다.
    expect([...document.querySelectorAll('[role="status"], [aria-live]')]).toEqual([announcer()])
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
  expect(props.capture.refreshSources).toHaveBeenCalledOnce()
  await act(async () => {
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
  await vi.waitFor(() => expect(document.activeElement).toBe(chip()))
  expect(props.capture.stopCapture).not.toHaveBeenCalled()
})

it('자동 감지한 창은 선택 전에 표시하고 사용자 클릭 전에는 캡처를 시작하지 않는다', async () => {
  props.phase = 'idle'
  props.capture.selectedSourceId = ''
  await openDialog()
  expect(trigger().textContent).toContain('던전앤파이터, 감지됨')
  const statuses = [...document.querySelectorAll('[role="dialog"] [role="status"]')]
  expect(statuses.map((status) => status.textContent)).toContain('창 감지됨')
  expect(document.body.textContent).not.toContain('캡처 중지')
  expect(props.capture.selectSource).not.toHaveBeenCalled()
  await click(trigger())
  const gameOption = document.querySelector<HTMLElement>(
    '[role="menuitemradio"][aria-label="던전앤파이터"]'
  )!
  expect(gameOption.getAttribute('aria-checked')).toBe('false')
  await click(gameOption)
  expect(props.capture.selectSource).toHaveBeenCalledExactlyOnceWith('game')
})

it('후보가 여러 개여도 임의로 선택하지 않고 발견한 개수를 표시한다', async () => {
  props.phase = 'idle'
  props.capture.selectedSourceId = ''
  props.capture.sources.push({ id: 'second-game', name: 'DNF' })
  await openDialog()
  expect(trigger().textContent).toContain('던파 창 2개 감지됨')
  expect(props.capture.selectSource).not.toHaveBeenCalled()
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
  expect(props.capture.selectSource).toHaveBeenCalledExactlyOnceWith('other')
  expect(trigger().getAttribute('aria-expanded')).toBe('false')
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  expect(props.capture.stopCapture).not.toHaveBeenCalled()
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
  expect(props.capture.selectSource).not.toHaveBeenCalled()
  expect(props.capture.stopCapture).not.toHaveBeenCalled()
})

it('조회 실패 시 이전 목록 선택을 막고 새로고침 명령만 실행한다', async () => {
  props.capture.sourcesFailed = true
  await openDialog()
  await click(trigger())
  expect(document.body.textContent).toContain('창 목록을 불러오지 못했습니다')
  const stale = document.querySelector<HTMLElement>('[role="menuitemradio"]')!
  expect(stale.getAttribute('aria-disabled')).toBe('true')
  await click(stale)
  expect(props.capture.selectSource).not.toHaveBeenCalled()
  const refresh = document.querySelector<HTMLElement>('[role="menuitem"]')!
  await act(async () =>
    refresh.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    )
  )
  expect(props.capture.refreshSources).toHaveBeenCalledTimes(2)
  expect(props.capture.selectSource).not.toHaveBeenCalled()
})

it('빈 목록, 사라진 선택과 로딩, 연결 미준비 상태를 처리한다', async () => {
  props.capture.sources = []
  await openDialog()
  expect(trigger().textContent).toContain('선택한 창, 목록에서 사라짐')
  await click(trigger())
  expect(searchingNotice().textContent).toBe('던전앤파이터 찾는 중')
  expect(searchingNotice().querySelector('[aria-hidden="true"]')?.children).toHaveLength(3)
  expect(document.querySelector('[role="menuitemradio"]')).toBeNull()
  await click(trigger())
  props.capture.sourcesLoading = true
  await render()
  expect(trigger().disabled).toBe(true)
  props.capture.sourcesLoading = false
  props.capture.search.ready = false
  await render()
  expect(trigger().disabled).toBe(true)
  expect(props.capture.selectSource).not.toHaveBeenCalled()
})

it.each([
  ['selecting', '준비 중', 'neutral', false],
  ['complete', '인식 완료', 'signal', false],
  ['recognizing', '인식 중', 'signal', true],
  ['unavailable', '확인 필요', 'warning', false]
] as const)(
  '대화상자 머리는 제목, %s 단계의 %s 칩, 새로고침, 닫기 순서이고 네 모서리 꺾쇠가 %s 톤을 따른다',
  async (phase, label, tone, busy) => {
    props.phase = phase
    await openDialog()
    const title = dialog().querySelector('h2')!
    expect(title.textContent).toBe('화면 캡처')
    expect(dialog().getAttribute('aria-labelledby')).toBe(title.id)
    const chip = dialog().querySelector<HTMLElement>('[role="status"][data-tone]')!
    expect(chip.textContent).toBe(label)
    expect(chip.dataset.tone).toBe(tone)
    expect(chip.hasAttribute('data-busy')).toBe(busy)
    const close = dialog().querySelector<HTMLButtonElement>('button[aria-label="닫기"]')!
    const refresh = [...dialog().querySelectorAll('button')].find(
      (button) => button.textContent === '새로고침'
    )!
    for (const [before, after] of [
      [title, chip],
      [chip, refresh],
      [refresh, close]
    ]) {
      expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    }
    const corners = [...dialog().querySelectorAll<HTMLElement>(':scope > [aria-hidden="true"]')]
    expect(corners).toHaveLength(4)
    expect(corners.every((corner) => corner.dataset.tone === tone)).toBe(true)
  }
)

// 꺾쇠의 class를 단계별로 모아 색과 움직임이 실제로 달라지는지 본다.
async function cornerClass(phase: CaptureControlsProps['phase']): Promise<string> {
  props.phase = phase
  await render()

  return dialog().querySelector<HTMLElement>(':scope > [aria-hidden="true"]')!.className
}

it('꺾쇠는 tone마다 다른 색이고, 같은 신호색 중 인식하는 동안만 움직임을 더 받는다', async () => {
  await openDialog()
  const neutral = await cornerClass('selecting')
  const success = await cornerClass('selected')
  const warning = await cornerClass('unavailable')
  const done = await cornerClass('complete')
  const recognizing = await cornerClass('recognizing')
  expect(new Set([neutral, success, warning, done]).size).toBe(4)
  // 인식 완료와 인식 중은 같은 신호색이고, 인식 중만 조여 드는 움직임 class가 더 붙는다.
  expect(recognizing).not.toBe(done)
  expect(recognizing.split(' ').length).toBeGreaterThan(done.split(' ').length)
})

it('닫기 버튼은 캡처를 유지한 채 대화상자만 닫는다', async () => {
  await openDialog()
  await click(dialog().querySelector<HTMLButtonElement>('button[aria-label="닫기"]')!)
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
  expect(props.capture.stopCapture).not.toHaveBeenCalled()
})

it('확인 필요 안내 앞에만 주의 칸을 두고, 창을 고르기 전에는 캡처 중지를 두지 않는다', async () => {
  props.phase = 'unavailable'
  props.status = '게임 창이 가려져 있습니다. 게임 창을 앞으로 가져온 뒤 Alt+R을 누르세요.'
  await openDialog()
  const notice = dialog().querySelector<HTMLElement>('p[role="status"]')!
  expect(notice.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('주의')
  expect(notice.textContent).toBe(`!${props.status}`)
  props.phase = 'complete'
  props.status = '인식을 마쳤습니다. 다시 인식하려면 Alt+R을 누르세요.'
  await render()
  expect(dialog().querySelector('p[role="status"] [role="img"]')).toBeNull()
  // 같은 주의 색이어도 창 미감지의 안내에는 `!` 칸을 붙이지 않는다.
  props.phase = 'selected'
  props.capture.sources = [{ id: 'other', name: '테스트 창' }]
  props.capture.selectedSourceId = 'other'
  props.status = 'Alt+R을 눌러 파티를 인식해 주세요.'
  await render()
  expect(dialog().querySelector('[role="status"][data-tone]')?.textContent).toBe('창 미감지')
  expect(dialog().querySelector('p[role="status"] [role="img"]')).toBeNull()
  props.capture.sources = [
    { id: 'other', name: '테스트 창' },
    { id: 'game', name: '던전앤파이터' }
  ]
  props.capture.selectedSourceId = 'game'
  const actions = () =>
    [...dialog().querySelectorAll('button')]
      .map((button) => button.getAttribute('aria-label') ?? button.textContent)
      .filter((name) => name === '닫기' || name === '캡처 중지' || name === '새로고침')
  // 머리 줄의 버튼 순서다. 아래쪽에는 닫기 버튼을 따로 두지 않는다.
  expect(actions()).toEqual(['캡처 중지', '새로고침', '닫기'])
  props.phase = 'idle'
  props.capture.selectedSourceId = ''
  props.capture.sources = []
  await render()
  expect(actions()).toEqual(['새로고침', '닫기'])
})

it('안내는 머리 줄의 상태 칩 오른쪽 한 줄이고 전체 문구를 title로 전한다', async () => {
  props.phase = 'failed'
  props.status = '게임 창을 선택하지 못했습니다. 창을 다시 선택해 주세요.'
  await openDialog()
  const chip = dialog().querySelector<HTMLElement>('[role="status"][data-tone]')!
  const notice = dialog().querySelector<HTMLElement>('p[role="status"]')!
  expect(notice.getAttribute('title')).toBe(props.status)
  expect(notice.parentElement).toBe(chip.parentElement)
  expect(chip.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  props.status = ''
  await render()
  expect(dialog().querySelector('p[role="status"]')).toBeNull()
})

it('새로고침 버튼은 창 목록을 다시 조회하고 대화상자를 연 채로 둔다', async () => {
  await openDialog()
  expect(props.capture.refreshSources).toHaveBeenCalledOnce()
  const refresh = [...dialog().querySelectorAll('button')].find(
    (button) => button.textContent === '새로고침'
  )!
  await click(refresh)
  expect(props.capture.refreshSources).toHaveBeenCalledTimes(2)
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
})

it('창을 찾는 동안 재조회 진행 막대가 마지막 조회 완료부터 15초 주기로 차고 새 조회 때 다시 시작한다', async () => {
  const start = 120_000
  const now = vi.spyOn(performance, 'now').mockReturnValue(start)
  props.phase = 'idle'
  props.capture.selectedSourceId = ''
  props.capture.sources = []
  await render()
  // 목록을 6초 뒤에 열면 막대는 이미 지난 6초만큼 앞당겨 시작한다.
  now.mockReturnValue(start + 6_000)
  await click(chip())
  await click(trigger())
  const timing = (name: string) => retryProgress()!.style.getPropertyValue(`--x-${name}`)
  expect(timing('animationDuration')).toBe('15000ms')
  expect(timing('animationDelay')).toBe('-6000ms')
  // 같은 목록으로 다시 그려도 시작 시각은 그대로다.
  now.mockReturnValue(start + 9_000)
  await render()
  expect(timing('animationDelay')).toBe('-6000ms')
  // 자동 재조회가 끝나 새 목록이 오면 그 순간부터 다시 찬다.
  props.capture.sources = []
  await render()
  expect(timing('animationDelay')).toBe('0ms')
  now.mockRestore()
})

it('던파 창이 있거나 조회가 실패하면 찾는 중 안내와 진행 막대를 두지 않는다', async () => {
  props.phase = 'idle'
  props.capture.selectedSourceId = ''
  await openDialog()
  await click(trigger())
  expect(retryProgress()).toBeNull()
  expect(document.body.textContent).not.toContain('던전앤파이터 찾는 중')
  await click(trigger())
  props.capture.sources = []
  props.capture.sourcesFailed = true
  await render()
  await click(trigger())
  expect(retryProgress()).toBeNull()
  expect(document.body.textContent).toContain('창 목록을 불러오지 못했습니다')
})

it('대화상자를 닫은 동안 화면 밖 안내가 캡처 문구를 알리고, 연 동안에는 대화상자 안 안내만 알린다', async () => {
  props.phase = 'unavailable'
  props.status = '게임 창이 가려져 있습니다. 게임 창을 앞으로 가져온 뒤 Alt+R을 누르세요.'
  await render()
  expect(announcer().textContent).toBe(props.status)
  expect(announcer().closest('[aria-hidden="true"], [inert]')).toBeNull()
  await click(chip())
  // 모달이 바깥을 가리므로 화면 밖 안내는 보조 기술에서 빠지고 대화상자 안 안내가 같은 문구를 알린다.
  expect(announcer().closest('[aria-hidden="true"], [inert]')).not.toBeNull()
  expect(dialog().querySelector('p[role="status"]')?.textContent).toBe(`!${props.status}`)
  await click(dialog().querySelector<HTMLButtonElement>('button[aria-label="닫기"]')!)
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
  props.phase = 'failed'
  props.status = '게임 창을 선택하지 못했습니다. 창을 다시 선택해 주세요.'
  await render()
  expect(announcer().textContent).toBe(props.status)
})

it('캡처가 실패로 끝나면 창 감지 대신 위험 톤의 캡처 실패와 실패 안내를 보인다', async () => {
  props.phase = 'failed'
  props.status = '게임 창을 선택하지 못했습니다. 창을 다시 선택해 주세요.'
  await render()
  expect(chip().getAttribute('aria-label')).toBe('화면 캡처, 캡처 실패')
  expect(chip().querySelector('[data-tone]')?.getAttribute('data-tone')).toBe('danger')
  await click(chip())
  const notice = dialog().querySelector<HTMLElement>('p[role="status"]')!
  const failureMark = notice.querySelector('[role="img"]')!
  expect(failureMark.getAttribute('aria-label')).toBe('실패')
  expect(notice.textContent).toBe(`!${props.status}`)
  // 실패 `!` 칸은 확인 필요의 주의 색 칸과 다른 위험 색이다.
  const failureClass = failureMark.className
  props.phase = 'unavailable'
  await render()
  const warningMark = dialog().querySelector('p[role="status"] [role="img"]')!
  expect(warningMark.getAttribute('aria-label')).toBe('주의')
  expect(warningMark.className).not.toBe(failureClass)
  props.phase = 'failed'
  await render()
  const corner = dialog().querySelector<HTMLElement>(':scope > [aria-hidden="true"]')!
  expect(corner.dataset.tone).toBe('danger')
  // 등록한 창이 남아 있으므로 캡처를 멈출 수 있다.
  expect(
    [...dialog().querySelectorAll('button')].some((button) => button.textContent === '캡처 중지')
  ).toBe(true)
})

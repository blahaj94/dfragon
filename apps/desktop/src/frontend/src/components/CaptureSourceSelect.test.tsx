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

function tiles(): HTMLInputElement[] {
  return [...dialog().querySelectorAll<HTMLInputElement>('input[type="radio"]')]
}

function tile(name: string): HTMLInputElement {
  return tiles().find((input) => input.getAttribute('aria-label') === name)!
}

function chip(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('button[aria-label^="화면 캡처"]')!
}

function dialog(): HTMLElement {
  return document.querySelector<HTMLElement>('[role="dialog"]')!
}

function searchingNotice(): HTMLElement | undefined {
  return [...dialog().querySelectorAll<HTMLElement>('[role="status"]')].find((status) =>
    status.textContent?.startsWith('던전앤파이터 찾는 중')
  )
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

it('자동 감지한 창은 선택 전에 타일로 표시하고 사용자 클릭 전에는 캡처를 시작하지 않는다', async () => {
  props.phase = 'idle'
  props.capture.selectedSourceId = ''
  await openDialog()
  const statuses = [...document.querySelectorAll('[role="dialog"] [role="status"]')]
  expect(statuses.map((status) => status.textContent)).toContain('창 감지됨')
  expect(document.body.textContent).not.toContain('캡처 중지')
  expect(tiles().map((input) => input.checked)).toEqual([false, false])
  expect(props.capture.selectSource).not.toHaveBeenCalled()
  await click(tile('던전앤파이터'))
  expect(props.capture.selectSource).toHaveBeenCalledExactlyOnceWith('game')
})

it('후보가 여러 개여도 임의로 선택하지 않고 모두 타일로 보인다', async () => {
  props.phase = 'idle'
  props.capture.selectedSourceId = ''
  props.capture.sources.push({ id: 'second-game', name: 'DNF' })
  await openDialog()
  expect(tiles().map((input) => input.getAttribute('aria-label'))).toEqual([
    '던전앤파이터',
    'DNF',
    '테스트 창'
  ])
  expect(tiles().some((input) => input.checked)).toBe(false)
  expect(props.capture.selectSource).not.toHaveBeenCalled()
})

it('감지된 게임을 먼저 두고 그룹 이름과 선택 표시를 타일 한 줄로 보인다', async () => {
  await openDialog()
  const group = dialog().querySelector('[role="radiogroup"]')!
  expect(group.getAttribute('aria-label')).toBe('캡처할 창')
  expect(tiles().map((input) => input.getAttribute('aria-label'))).toEqual([
    '던전앤파이터',
    '테스트 창'
  ])
  expect(tiles().map((input) => input.parentElement?.textContent)).toEqual([
    '던전앤파이터감지된 게임',
    '테스트 창다른 창'
  ])
  expect(tiles().map((input) => input.checked)).toEqual([true, false])
  expect(tiles().map((input) => input.parentElement?.querySelector('svg') != null)).toEqual([
    true,
    false
  ])
  await click(tile('테스트 창'))
  expect(props.capture.selectSource).toHaveBeenCalledExactlyOnceWith('other')
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  expect(props.capture.stopCapture).not.toHaveBeenCalled()
})

it('긴 창 이름은 한 줄로 말줄임하고 전체 이름을 title로 전한다', async () => {
  const name = '아주 긴 이름을 가진 던전앤파이터 게임 창 제목 아주 긴 이름을 가진 던전앤파이터'
  props.capture.sources = [{ id: 'long', name }]
  await openDialog()
  expect(tile(name).parentElement?.getAttribute('title')).toBe(name)
})

it('조회 실패 시 실패 타일을 두고 이전 목록 선택을 막는다', async () => {
  props.capture.sourcesFailed = true
  await openDialog()
  const failure = [...dialog().querySelectorAll<HTMLElement>('[role="status"]')].find((status) =>
    status.textContent?.includes('창 목록을 불러오지 못했습니다')
  )
  expect(failure?.textContent).toContain('15초마다 다시 확인합니다')
  expect(tiles().every((input) => input.disabled)).toBe(true)
  await click(tile('테스트 창'))
  expect(props.capture.selectSource).not.toHaveBeenCalled()
  expect(document.body.textContent).not.toContain('창 목록 새로고침')
})

it('빈 목록, 사라진 선택과 로딩, 연결 미준비 상태를 처리한다', async () => {
  props.capture.sources = []
  await openDialog()
  expect(tiles().map((input) => [input.getAttribute('aria-label'), input.checked])).toEqual([
    ['선택한 창', true]
  ])
  expect(searchingNotice()?.textContent).toBe('던전앤파이터 찾는 중')
  expect(searchingNotice()?.querySelector('[aria-hidden="true"]')?.children).toHaveLength(3)
  props.capture.selectedSourceId = ''
  await render()
  expect(tiles()).toHaveLength(0)
  props.capture.sources = [{ id: 'game', name: '던전앤파이터' }]
  props.capture.sourcesLoading = true
  await render()
  expect(tiles().every((input) => input.disabled)).toBe(true)
  props.capture.sourcesLoading = false
  props.capture.search.ready = false
  await render()
  expect(tiles().every((input) => input.disabled)).toBe(true)
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
  props.capture.sourcesLoading = true
  await render()
  expect(refresh.disabled).toBe(true)
})

it('창을 찾는 동안 재조회 진행 막대가 마지막 조회 완료부터 15초 주기로 차고 새 조회 때 다시 시작한다', async () => {
  const start = 120_000
  const now = vi.spyOn(performance, 'now').mockReturnValue(start)
  props.phase = 'idle'
  props.capture.selectedSourceId = ''
  props.capture.sources = []
  await render()
  now.mockReturnValue(start + 6_000)
  await click(chip())
  const timing = (name: string) => retryProgress()!.style.getPropertyValue(`--x-${name}`)
  expect(timing('animationDuration')).toBe('15000ms')
  expect(timing('animationDelay')).toBe('-6000ms')
  now.mockReturnValue(start + 9_000)
  await render()
  expect(timing('animationDelay')).toBe('-6000ms')
  props.capture.sources = []
  await render()
  expect(timing('animationDelay')).toBe('0ms')
  now.mockRestore()
})

it('던파 창이 있거나 조회가 실패하면 찾는 중 안내와 진행 막대를 두지 않는다', async () => {
  props.phase = 'idle'
  props.capture.selectedSourceId = ''
  await openDialog()
  expect(retryProgress()).toBeNull()
  expect(document.body.textContent).not.toContain('던전앤파이터 찾는 중')
  props.capture.sources = []
  props.capture.sourcesFailed = true
  await render()
  expect(retryProgress()).toBeNull()
  expect(searchingNotice()).toBeUndefined()
  expect(document.body.textContent).toContain('창 목록을 불러오지 못했습니다')
})

it('대화상자를 닫은 동안 화면 밖 안내가 캡처 문구를 알리고, 연 동안에는 대화상자 안 안내만 알린다', async () => {
  props.phase = 'unavailable'
  props.status = '게임 창이 가려져 있습니다. 게임 창을 앞으로 가져온 뒤 Alt+R을 누르세요.'
  await render()
  expect(announcer().textContent).toBe(props.status)
  expect(announcer().closest('[aria-hidden="true"], [inert]')).toBeNull()
  await click(chip())
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
  expect(
    [...dialog().querySelectorAll('button')].some((button) => button.textContent === '캡처 중지')
  ).toBe(true)
})

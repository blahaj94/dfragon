// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ColorThemeProvider } from './components/ColorThemeProvider'
import App from './App'

const capture = vi.hoisted(() => {
  const selectAndStartCapture = vi.fn()
  const refreshSources = vi.fn()
  const stopCapture = vi.fn()

  return {
    search: {
      connectionFailed: false,
      ready: true,
      manualSlots: [false, false, false, false],
      lookupSlot: vi.fn(),
      retryPending: [false, false, false, false],
      slots: Array.from({ length: 4 }, (_, slot) => ({
        slot,
        observationRevision: 0,
        requestId: null,
        nickname: null,
        state: 'idle',
        rows: [],
        error: null
      }))
    },
    retrySearch: vi.fn(),
    selectedSourceId: '',
    status: '캡처 대기',
    stableNicknames: [null, null, null, null],
    recognitionStates: ['idle', 'idle', 'idle', 'idle'],
    round: 0,
    starting: false,
    sources: [],
    sourcesLoading: false,
    sourcesFailed: false,
    phase: 'idle',
    selectAndStartCapture,
    refreshSources,
    stopCapture
  }
})

vi.mock('./hooks/usePartyCapture', () => ({ usePartyCapture: () => capture }))
vi.mock('./components/CaptureControls', () => ({
  CaptureControls: () => <button aria-label="화면 캡처">화면 캡처</button>
}))
vi.mock('./sections/LoginSection', () => ({ LoginSection: () => null }))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  Reflect.deleteProperty(window, 'developer')
  container.remove()
  vi.unstubAllGlobals()
})

function button(label: string): HTMLButtonElement {
  const result = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) =>
      candidate.getAttribute('aria-label') === label || candidate.textContent?.includes(label)
  )
  if (result == null) {
    throw new Error(`Missing ${label} button`)
  }

  return result
}

async function click(label: string): Promise<void> {
  await act(async () => button(label).click())
}

async function toggle(label: string): Promise<void> {
  const input = [...container.querySelectorAll<HTMLInputElement>('input[role="switch"]')].find(
    (candidate) => candidate.labels?.[0]?.textContent === label
  )
  if (input == null) {
    throw new Error(`Missing ${label} switch`)
  }

  await act(async () => input.click())
}

function installDeveloperApi() {
  const developer = {
    onPartyCollectionStatus: vi.fn(() => vi.fn()),
    getSettings: vi.fn(async () => ({ enabled: false })),
    setEnabled: vi.fn(async (enabled: boolean) => ({ enabled })),
    listSamples: vi.fn(async () => []),
    readImage: vi.fn(async () => 'data:image/png;base64,AA=='),
    addSample: vi.fn(),
    saveLabel: vi.fn(),
    setSampleExcluded: vi.fn(),
    previewParty: vi.fn(async () => ({
      frame: null,
      previewError: 'game-window-unavailable',
      collection: {
        armed: true,
        slots: [1, 2, 3, 4],
        revision: 0,
        lastSavedAt: null,
        error: null
      }
    })),
    setPartyCollectionSlots: vi.fn(async (slots: number[] | null) => {
      const armed = slots != null
      const selectedSlots = slots ?? []

      return {
        armed,
        slots: selectedSlots,
        revision: 0,
        lastSavedAt: null,
        error: null
      }
    })
  }
  Object.defineProperty(window, 'developer', { configurable: true, value: developer })

  return developer
}

async function renderApp(): Promise<void> {
  await act(async () =>
    root.render(
      <ColorThemeProvider initialTheme="dark">
        <App />
      </ColorThemeProvider>
    )
  )
}

it('stops normal capture and preserves the party page while the workbench is open', async () => {
  const developer = installDeveloperApi()
  await renderApp()

  const topBar = container.querySelector('main > header')!
  expect(topBar.querySelector('[aria-label="화면 캡처"]')).not.toBeNull()
  expect(topBar.textContent).toContain('창 미감지')

  await click('설정')
  await click('개발자 모드')
  await toggle('개발자 모드')
  await click('개발 도구 열기')

  expect(developer.setEnabled).toHaveBeenCalledExactlyOnceWith(true)
  expect(capture.stopCapture).toHaveBeenCalledExactlyOnceWith(
    '개발 도구를 여는 동안 화면 캡처를 중지했습니다.'
  )
  expect(container.querySelector('[aria-label="개발자 작업 공간"]')).not.toBeNull()
  expect(container.querySelector('main > header')).toBe(topBar)
  expect(topBar.querySelector('[aria-label="화면 캡처"]')).toBeNull()
  expect(topBar.textContent).not.toContain('창 미감지')
  expect(topBar.textContent).toContain('DFragon')
  expect(topBar.querySelector('[aria-label="라이트 테마"]')).not.toBeNull()
  expect(topBar.querySelector('[aria-label="설정"]')).not.toBeNull()
  expect(container.querySelector('[aria-label="파티 캐릭터"]')?.closest('[hidden]')).not.toBeNull()
  expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain(
    '이미지 수집'
  )

  await click('정답 입력')
  expect(container.querySelector('[aria-label="정답 입력"]')).not.toBeNull()
  await click('이미지 수집')
  expect(developer.setPartyCollectionSlots).toHaveBeenCalledWith(null)

  await click('일반 화면으로 돌아가기')
  expect(container.querySelector('[aria-label="개발자 작업 공간"]')).toBeNull()
  expect(topBar.querySelector('[aria-label="화면 캡처"]')).not.toBeNull()
  expect(topBar.textContent).toContain('창 미감지')
  expect(container.querySelector('[aria-label="파티 캐릭터"]')?.closest('[hidden]')).toBeNull()
})

it('작업 공간에서 개발자 모드를 끄면 작업 공간을 닫고, 다시 켜도 캡처 중지 없이 열지 않는다', async () => {
  const developer = installDeveloperApi()
  await renderApp()
  await click('설정')
  await click('개발자 모드')
  await toggle('개발자 모드')
  await click('개발 도구 열기')
  expect(container.querySelector('[aria-label="개발자 작업 공간"]')).not.toBeNull()
  expect(capture.stopCapture).toHaveBeenCalledOnce()

  await click('설정')
  await click('개발자 모드')
  await toggle('개발자 모드')
  expect(developer.setEnabled).toHaveBeenLastCalledWith(false)
  expect(container.querySelector('[aria-label="개발자 작업 공간"]')).toBeNull()

  await toggle('개발자 모드')
  expect(developer.setEnabled).toHaveBeenLastCalledWith(true)
  expect(container.querySelector('[aria-label="개발자 작업 공간"]')).toBeNull()
  expect(capture.stopCapture).toHaveBeenCalledOnce()
  expect(container.querySelector('main > header [aria-label="화면 캡처"]')).not.toBeNull()
})

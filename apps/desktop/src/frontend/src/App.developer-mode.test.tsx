// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ColorThemeProvider } from './components/ColorThemeProvider'
import App from './App'

const capture = vi.hoisted(() => ({
  search: { connectionFailed: false, ready: true },
  selectedSourceId: '',
  status: '캡처 대기',
  stableNicknames: [null, null, null, null],
  sources: [],
  sourcesLoading: false,
  sourcesFailed: false,
  phase: 'idle',
  selectAndStartCapture: vi.fn(),
  refreshSources: vi.fn(),
  stopCapture: vi.fn()
}))

vi.mock('./hooks/usePartyCapture', () => ({ usePartyCapture: () => capture }))
vi.mock('./components/CaptureControls', () => ({ CaptureControls: () => null }))
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

it('stops normal capture and preserves the party page while the workbench is open', async () => {
  const developer = {
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
    setPartyCollectionSlots: vi.fn(async (slots: number[] | null) => ({
      armed: slots != null,
      slots: slots ?? [],
      revision: 0,
      lastSavedAt: null,
      error: null
    }))
  }
  Object.defineProperty(window, 'developer', { configurable: true, value: developer })

  await act(async () =>
    root.render(
      <ColorThemeProvider initialTheme="dark">
        <App />
      </ColorThemeProvider>
    )
  )

  await click('설정')
  await click('개발자 모드')
  await click('개발자 모드 켜기')
  await click('개발 도구 열기')

  expect(developer.setEnabled).toHaveBeenCalledExactlyOnceWith(true)
  expect(capture.stopCapture).toHaveBeenCalledExactlyOnceWith(
    '개발 도구를 여는 동안 화면 캡처를 중지했습니다.'
  )
  expect(container.querySelector('[aria-label="개발자 작업 공간"]')).not.toBeNull()
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
  expect(container.querySelector('[aria-label="파티 캐릭터"]')?.closest('[hidden]')).toBeNull()
})

// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AuthSnapshot } from '../../../preload/common/types/auth'
import { searchSnapshot } from '../../../preload/api/search-test-fixture'
import App from '../App'

let root: Root
let container: HTMLDivElement
let listener: ((snapshot: AuthSnapshot) => void) | undefined
const capture = {
  listCaptureSources: vi.fn(),
  selectCaptureSource: vi.fn(),
  notifyStableNicknameDetected: vi.fn()
}
const auth = {
  getAuthState: vi.fn(),
  onAuthStateChanged: vi.fn(),
  beginLogin: vi.fn(),
  cancelLogin: vi.fn(),
  retryAuth: vi.fn(),
  logout: vi.fn()
}
const search = {
  controlCharacterSearch: vi.fn(),
  onCharacterSearchChanged: vi.fn()
}
function snapshot(revision: number, phase: 'signedIn' | 'signedOut'): AuthSnapshot {
  const isSignedIn = phase === 'signedIn'
  return {
    runId: 'fixture-run',
    revision,
    phase,
    providers: [],
    login: null,
    user: isSignedIn ? { nickname: 'Synthetic' } : null,
    entry: isSignedIn ? 'home' : null,
    notice: null
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  Object.defineProperty(window, 'api', { configurable: true, value: capture })
  Object.defineProperty(window, 'auth', { configurable: true, value: auth })
  Object.defineProperty(window, 'search', { configurable: true, value: search })
  Object.defineProperty(window, 'manualSearch', {
    configurable: true,
    value: { ...search, notifyManualNickname: vi.fn() }
  })
  search.controlCharacterSearch.mockResolvedValue({
    ok: true,
    snapshot: searchSnapshot({ captureId: null, revision: 0 })
  })
  search.onCharacterSearchChanged.mockReturnValue(vi.fn())
  capture.listCaptureSources.mockResolvedValue([{ id: 'fixture', name: 'Synthetic window' }])
  capture.selectCaptureSource.mockResolvedValue({ id: 'fixture', name: 'Synthetic window' })
  auth.onAuthStateChanged.mockImplementation((next) => {
    listener = next
    return vi.fn()
  })
  container = document.createElement('div')
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
})
function startButton(): HTMLButtonElement {
  const start = Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent === '캡처 시작'
  )
  expect(start).toBeDefined()
  return start!
}

async function selectGameWindow(): Promise<HTMLSelectElement> {
  const selection = container.querySelector('select')!
  expect(selection).not.toBeNull()
  await act(async () => {
    selection.value = 'fixture'
    selection.dispatchEvent(new Event('change', { bubbles: true }))
  })
  return selection
}

function expectSelectionRetained(selection: HTMLSelectElement): void {
  expect(container.querySelector('select')).toBe(selection)
  expect(selection.value).toBe('fixture')
  expect(startButton().disabled).toBe(false)
  expect(capture.listCaptureSources).toHaveBeenCalledOnce()
  expect(capture.selectCaptureSource).toHaveBeenCalledExactlyOnceWith('fixture')
}

it('auth 로딩과 연결 실패 중에도 직접 검색과 게임 창 선택을 사용할 수 있다', async () => {
  const pending = Promise.withResolvers<AuthSnapshot>()
  auth.getAuthState.mockReturnValue(pending.promise)
  await act(async () => root.render(<App />))
  expect(container.textContent).toContain('인증 상태를 확인하고 있습니다')
  expect(container.querySelector('form button')?.hasAttribute('disabled')).toBe(false)
  expect(startButton().disabled).toBe(true)
  const selection = await selectGameWindow()

  await act(async () => pending.reject(new Error('No handler registered')))
  expect(container.textContent).toContain('인증 연결을 확인할 수 없습니다')
  expect(container.querySelector('form button')?.hasAttribute('disabled')).toBe(false)
  expectSelectionRetained(selection)
})
it('비로그인으로 선택한 창은 로그인과 로그아웃 뒤에도 유지하고 unmount 때 정리한다', async () => {
  auth.getAuthState.mockResolvedValue(snapshot(1, 'signedOut'))
  await act(async () => root.render(<App />))
  expect(startButton().disabled).toBe(true)
  const selection = await selectGameWindow()
  await act(async () => listener?.(snapshot(2, 'signedIn')))
  expectSelectionRetained(selection)
  await act(async () => listener?.(snapshot(3, 'signedOut')))
  expectSelectionRetained(selection)

  await act(async () => root.unmount())
  expect(capture.selectCaptureSource).toHaveBeenLastCalledWith('')
  expect(capture.selectCaptureSource).toHaveBeenCalledTimes(2)
  root = createRoot(container)
})

it('인증 이탈과 새 signedIn이 한 render로 합쳐져도 capture 선택을 유지한다', async () => {
  auth.getAuthState.mockResolvedValue(snapshot(1, 'signedIn'))
  await act(async () => root.render(<App />))
  const selection = await selectGameWindow()
  expect(container.querySelector('select')?.value).toBe('fixture')

  await act(async () => listener?.(snapshot(2, 'signedIn')))
  expect(container.querySelector('select')?.value).toBe('fixture')
  expect(capture.listCaptureSources).toHaveBeenCalledOnce()

  await act(async () => {
    listener?.(snapshot(3, 'signedOut'))
    listener?.(snapshot(4, 'signedIn'))
  })

  expectSelectionRetained(selection)
})

it('인증 runId 재연결은 독립된 capture 선택을 초기화하지 않는다', async () => {
  auth.getAuthState.mockResolvedValue(snapshot(1, 'signedIn'))
  await act(async () => root.render(<App />))
  const selection = await selectGameWindow()
  expect(container.querySelector('select')?.value).toBe('fixture')

  const reconnected = { ...snapshot(1, 'signedIn'), runId: 'next-fixture-run' }
  auth.getAuthState.mockResolvedValue(reconnected)
  await act(async () => listener?.(reconnected))

  expect(auth.getAuthState).toHaveBeenCalledTimes(2)
  expectSelectionRetained(selection)
})

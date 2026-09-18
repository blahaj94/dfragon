// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import type { AuthApi, AuthSnapshot } from '../../preload/common/types/auth'

let root: Root
let container: HTMLDivElement
let snapshot: AuthSnapshot
let listeners: Set<(snapshot: AuthSnapshot) => void>
let api: AuthApi

async function click(label: string): Promise<void> {
  const button = [...document.querySelectorAll('button')].find(
    (element) => element.textContent === label || element.getAttribute('aria-label') === label
  )!
  expect(button).toBeDefined()
  await act(async () => button.click())
}

function publish(change: Partial<AuthSnapshot>): AuthSnapshot {
  snapshot = { ...snapshot, ...change, revision: snapshot.revision + 1 }
  listeners.forEach((listener) => listener(snapshot))
  return snapshot
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }))
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  snapshot = {
    runId: 'test-run',
    revision: 1,
    phase: 'signedOut',
    providers: ['passkey'],
    login: null,
    user: null,
    entry: null,
    notice: null
  }
  listeners = new Set()
  api = {
    getAuthState: vi.fn(async () => snapshot),
    onAuthStateChanged: vi.fn((listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }),
    beginLogin: vi.fn<AuthApi['beginLogin']>(async () => ({
      ok: true,
      snapshot: publish({
        phase: 'waitingBrowser',
        notice: null,
        login: { attemptId: 'test-attempt', provider: 'passkey', expiresAt: null }
      })
    })),
    cancelLogin: vi.fn<AuthApi['cancelLogin']>(async () => ({
      ok: true,
      snapshot: publish({ phase: 'signedOut', login: null, notice: 'LOGIN_CANCELLED' })
    })),
    retryAuth: vi.fn<AuthApi['retryAuth']>(async () => ({ ok: true, snapshot })),
    logout: vi.fn<AuthApi['logout']>(async () => ({
      ok: true,
      snapshot: publish({ phase: 'signedOut', user: null, entry: null })
    })),
    managePasskeys: vi.fn<AuthApi['managePasskeys']>(async () => ({ ok: true, snapshot }))
  }
  vi.stubGlobal('auth', api)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  delete document.documentElement.dataset.seedColorMode
  vi.unstubAllGlobals()
})

it('기본 앱은 샘플 데이터와 구버전 폼 없이 빈 카드 네 개로 시작한다', async () => {
  await act(async () => root.render(<App />))

  const slots = container.querySelectorAll('article')
  expect(slots).toHaveLength(4)
  for (const [index, slot] of [...slots].entries()) {
    expect(slot.getAttribute('aria-label')).toBe(`${index + 1}번 슬롯`)
    const input = slot.querySelector('input')!
    expect(input.value).toBe('')
    expect(input.disabled).toBe(true)
    expect(slot.querySelector('button')).toBeNull()
  }
  expect(container.querySelector('form')).toBeNull()
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('[aria-label="미리보기 상태"]')).toBeNull()
  expect(container.textContent).not.toContain('닉네임 수정')
  expect(container.textContent).toContain('검색·캡처 기능 준비 중')
  expect(
    container.querySelector<HTMLButtonElement>('[aria-label="캡처 연결 예정"]')!.disabled
  ).toBe(true)
  const login = [...container.querySelectorAll('button')].find(
    (button) => button.textContent === '로그인'
  )!
  expect(login.disabled).toBe(false)
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it('카드 화면에서 로그인 시작·취소·실패 후 재시도·성공·로그아웃을 연결한다', async () => {
  await act(async () => root.render(<App />))
  const cards = [...container.querySelectorAll('article')]
  await click('로그인')
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(api.beginLogin).toHaveBeenCalledExactlyOnceWith({ provider: 'passkey' })
  expect(container.querySelector('header')?.textContent).toContain('로그인')
  expect(container.querySelector('header [data-progress-state="indeterminate"]')).not.toBeNull()
  await click('로그인')
  await click('로그인 취소')
  expect(api.cancelLogin).toHaveBeenCalledExactlyOnceWith({ attemptId: 'test-attempt' })
  expect(container.querySelector('header')?.textContent).toContain('로그인')
  expect(container.querySelector('header [data-progress-state="indeterminate"]')).toBeNull()
  await click('로그인')
  await act(async () => {
    publish({ phase: 'signedOut', login: null, notice: 'NETWORK_UNAVAILABLE' })
  })
  expect(container.querySelector('header')?.textContent).toContain('로그인')
  expect(container.querySelector('header [data-progress-state="indeterminate"]')).toBeNull()
  await click('로그인')
  await act(async () => {
    publish({
      phase: 'signedIn',
      login: null,
      notice: null,
      user: { nickname: '테스트모험가' },
      entry: 'welcome'
    })
  })
  expect(container.querySelector('header')?.textContent).toContain('내 계정')
  await click('내 계정')
  expect(document.body.textContent).toContain('테스트모험가')
  await click('이 기기 로그아웃')
  expect(api.logout).toHaveBeenCalledExactlyOnceWith()
  expect(container.querySelector('header')?.textContent).toContain('로그인')
  expect(document.body.textContent).not.toContain('테스트모험가')
  expect([...container.querySelectorAll('article')]).toEqual(cards)
})

it('계정 창을 닫아도 구독과 진행 상태를 유지하고 다시 열어 취소할 수 있다', async () => {
  await act(async () => root.render(<App />))
  await click('로그인')
  await click('로그인')
  await click('닫기')
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
  expect(listeners.size).toBe(1)
  expect(api.cancelLogin).not.toHaveBeenCalled()
  await click('로그인')
  await click('로그인 취소')
  expect(api.cancelLogin).toHaveBeenCalledExactlyOnceWith({ attemptId: 'test-attempt' })
})

it('재실행 조회의 복원 결과를 계정 창을 열기 전 반영하고 unmount 때 구독을 해제한다', async () => {
  snapshot = { ...snapshot, phase: 'restoring' }
  await act(async () => root.render(<App />))
  expect(container.querySelector('header')?.textContent).toContain('로그인')
  expect(container.querySelector('header [data-progress-state="indeterminate"]')).not.toBeNull()
  await act(async () => {
    publish({ phase: 'signedIn', user: { nickname: '복원모험가' }, entry: 'home' })
  })
  expect(container.querySelector('header')?.textContent).toContain('내 계정')
  await act(async () => root.unmount())
  expect(listeners.size).toBe(0)
  root = createRoot(container)
  await act(async () => root.render(<App />))
  await click('내 계정')
  expect(document.body.textContent).toContain('복원모험가')
  expect(document.body.textContent).not.toContain('시작하기')
  expect(api.getAuthState).toHaveBeenCalledTimes(2)
  expect(api.beginLogin).not.toHaveBeenCalled()
})

it('인증 연결 실패 중에도 카드·테마를 유지하고 연결 재확인은 로그인 명령을 보내지 않는다', async () => {
  vi.mocked(api.getAuthState).mockRejectedValueOnce(new Error('test connection unavailable'))
  await act(async () => root.render(<App />))
  const cards = [...container.querySelectorAll('article')]
  await click('로그인')
  expect(document.body.textContent).toContain('인증 연결을 확인할 수 없습니다')
  await click('연결 다시 확인')
  expect(api.getAuthState).toHaveBeenCalledTimes(2)
  expect(api.beginLogin).not.toHaveBeenCalled()
  expect(document.body.textContent).not.toContain('패스키로 계속하기')
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
  await click('라이트 테마')
  expect(document.documentElement.dataset.seedColorMode).toBe('light-only')
  expect([...container.querySelectorAll('article')]).toEqual(cards)
})

it.each(['restorePaused', 'storageBlocked'] as const)(
  '%s에서 기존 복구 명령을 사용하고 카드를 유지한다',
  async (phase) => {
    snapshot = {
      ...snapshot,
      phase,
      notice: phase === 'storageBlocked' ? 'SECURE_STORAGE_UNAVAILABLE' : 'RESTORE_RETRY_REQUIRED'
    }
    await act(async () => root.render(<App />))
    const trigger = container.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]')!
    await act(async () => trigger.click())
    await click('다시 시도')
    expect(api.retryAuth).toHaveBeenCalledExactlyOnceWith()
    expect(api.beginLogin).not.toHaveBeenCalled()
    expect(container.querySelectorAll('article')).toHaveLength(4)
  }
)

it('새 기본 화면에서 다크·라이트 테마를 전환한다', async () => {
  await act(async () => root.render(<App />))
  expect(document.documentElement.dataset.seedColorMode).toBe('dark-only')

  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="라이트 테마"]')!.click()
  )
  expect(document.documentElement.dataset.seedColorMode).toBe('light-only')

  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="다크 테마"]')!.click()
  )
  expect(document.documentElement.dataset.seedColorMode).toBe('dark-only')
})

// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { searchSnapshot } from '../../preload/api/search-test-fixture'
import { ColorThemeProvider } from './components/ColorThemeProvider'
import type { AuthApi, AuthSnapshot } from '../../preload/common/types/auth'
import type { WindowChromeApi } from '../../preload/common/types/window-chrome'

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
    beginLogin: vi.fn<AuthApi['beginLogin']>(async () => {
      const published = publish({
        phase: 'waitingBrowser',
        notice: null,
        login: { attemptId: 'test-attempt', provider: 'passkey', expiresAt: null }
      })

      return { ok: true, snapshot: published }
    }),
    cancelLogin: vi.fn<AuthApi['cancelLogin']>(async () => {
      const published = publish({ phase: 'signedOut', login: null, notice: 'LOGIN_CANCELLED' })

      return { ok: true, snapshot: published }
    }),
    retryAuth: vi.fn<AuthApi['retryAuth']>(async () => ({ ok: true, snapshot })),
    logout: vi.fn<AuthApi['logout']>(async () => {
      const published = publish({ phase: 'signedOut', user: null, entry: null })

      return { ok: true, snapshot: published }
    }),
    managePasskeys: vi.fn<AuthApi['managePasskeys']>(async () => ({ ok: true, snapshot }))
  }
  vi.stubGlobal('auth', api)
  vi.stubGlobal('api', {
    listCaptureSources: vi.fn(async () => []),
    selectCaptureSource: vi.fn(async () => null),
    notifyStableNicknameDetected: vi.fn()
  })
  vi.stubGlobal('search', {
    controlCharacterSearch: vi.fn(async () => {
      const snapshot = searchSnapshot({ captureId: null })

      return { ok: true, snapshot }
    }),
    onCharacterSearchChanged: vi.fn(() => () => {})
  })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  delete document.documentElement.dataset.theme
  vi.unstubAllGlobals()
})

it('기본 앱은 빈 카드 네 개에서 이름과 서버를 바로 수정할 수 있다', async () => {
  await act(async () =>
    root.render(
      <ColorThemeProvider>
        <App />
      </ColorThemeProvider>
    )
  )

  const slots = container.querySelectorAll('article')
  expect(slots).toHaveLength(4)
  for (const [index, slot] of [...slots].entries()) {
    expect(slot.getAttribute('aria-label')).toBe(`${index + 1}번 슬롯`)
    const input = slot.querySelector('input')!
    expect(input.value).toBe('')
    expect(input.disabled).toBe(false)
    expect(
      slot.querySelector<HTMLButtonElement>(`[aria-label="${index + 1}번 서버"]`)!.disabled
    ).toBe(false)
    expect(slot.querySelector('[aria-label*="상세 열기"]')).toBeNull()
    expect(slot.querySelector('img')).toBeNull()
  }
  expect(container.querySelector('form')).toBeNull()
  // 로고는 이미지 대신 brand.logo 면의 마크이고, 푸터 없이 캡처 진행 문구를 파티 머리에서 알린다.
  expect(container.querySelectorAll('img')).toHaveLength(0)
  expect(container.querySelector('footer')).toBeNull()
  expect(container.querySelector('main')?.firstElementChild?.tagName).toBe('HEADER')
  expect(container.querySelector('header')?.textContent).toContain('창 미감지')
  expect(container.querySelector('header [role="status"]')).toBeNull()
  expect(container.querySelector('[aria-label="미리보기 상태"]')).toBeNull()
  expect(container.textContent).not.toContain('닉네임 수정')
  const partyHeading = container.querySelector('h1')!
  expect(partyHeading.textContent).toBe('파티')
  expect(partyHeading.parentElement?.querySelector('[role="status"]')?.textContent).toBe(
    '캡처 대기'
  )
  expect(container.querySelector<HTMLButtonElement>('[aria-label="화면 캡처"]')!.disabled).toBe(
    false
  )
  const login = [...container.querySelectorAll('button')].find(
    (button) => button.textContent === '로그인'
  )!
  expect(login.disabled).toBe(false)
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it('상단 바의 취소, 로그인 실패, 성공과 외부 로그아웃 이후에도 카드를 유지한다', async () => {
  await act(async () =>
    root.render(
      <ColorThemeProvider>
        <App />
      </ColorThemeProvider>
    )
  )
  const cards = [...container.querySelectorAll('article')]
  const loginButton = container.querySelector('header button[aria-label="로그인"]')
  await click('로그인')
  expect(container.querySelector('header button[aria-label="취소"]')).toBe(loginButton)
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(api.beginLogin).toHaveBeenCalledExactlyOnceWith({ provider: 'passkey' })
  expect(container.querySelector('header')?.textContent).toContain('취소')
  expect(container.querySelector('header [aria-busy="true"]')).not.toBeNull()
  await click('취소')
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(api.beginLogin).toHaveBeenCalledTimes(1)
  expect(api.cancelLogin).toHaveBeenCalledExactlyOnceWith({ attemptId: 'test-attempt' })
  expect(container.querySelector('header')?.textContent).toContain('로그인')
  expect(container.querySelector('header [aria-busy="true"]')).toBeNull()
  await click('로그인')
  await act(async () => {
    publish({ phase: 'signedOut', login: null, notice: 'NETWORK_UNAVAILABLE' })
  })
  expect(container.querySelector('header')?.textContent).toContain('로그인')
  expect(container.querySelector('header [aria-busy="true"]')).toBeNull()
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
  expect(container.querySelector('header button[aria-label="로그인"]')).toBeNull()
  expect(container.querySelector('header button[aria-label="취소"]')).toBeNull()
  expect(document.body.textContent).not.toContain('내 계정')
  expect(document.body.textContent).not.toContain('테스트모험가')
  await act(async () => {
    await api.logout()
  })
  expect(api.logout).toHaveBeenCalledExactlyOnceWith()
  expect(container.querySelector('header')?.textContent).toContain('로그인')
  expect(document.body.textContent).not.toContain('테스트모험가')
  expect([...container.querySelectorAll('article')]).toEqual(cards)
})

it.each(['startingLogin', 'waitingBrowser', 'exchanging'] as const)(
  '%s에서 취소 버튼을 표시하고 응답 대기 중 재클릭도 현재 attempt로 전달한다',
  async (phase) => {
    snapshot = {
      ...snapshot,
      phase,
      login: {
        attemptId: 'current-attempt',
        provider: 'passkey',
        expiresAt: phase === 'startingLogin' ? null : '2030-01-01T00:10:00Z'
      }
    }
    let finishCancellation!: (result: Awaited<ReturnType<AuthApi['cancelLogin']>>) => void
    const cancellation = new Promise<Awaited<ReturnType<AuthApi['cancelLogin']>>>((resolve) => {
      finishCancellation = resolve
    })
    vi.mocked(api.cancelLogin).mockReturnValue(cancellation)
    await act(async () =>
      root.render(
        <ColorThemeProvider>
          <App />
        </ColorThemeProvider>
      )
    )

    const cancel = container.querySelector<HTMLButtonElement>('header button[aria-label="취소"]')!
    expect(cancel.textContent).toBe('취소')
    expect(cancel.disabled).toBe(false)
    expect(cancel.getAttribute('aria-busy')).toBe('true')
    const icon = cancel.firstElementChild!
    expect(icon.tagName).toBe('svg')
    expect(icon.getAttribute('width')).toBe('16')
    expect(icon.getAttribute('height')).toBe('16')
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    await click('취소')
    expect(cancel.disabled).toBe(false)
    await click('취소')
    expect(api.cancelLogin).toHaveBeenCalledTimes(2)
    expect(vi.mocked(api.cancelLogin).mock.calls).toEqual([
      [{ attemptId: 'current-attempt' }],
      [{ attemptId: 'current-attempt' }]
    ])
    expect(api.beginLogin).not.toHaveBeenCalled()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(listeners.size).toBe(1)

    await act(async () => {
      finishCancellation({
        ok: true,
        snapshot: {
          ...snapshot,
          revision: 2,
          phase: 'signedOut',
          login: null,
          notice: 'LOGIN_CANCELLED'
        }
      })
    })
    expect(container.querySelector('header button[aria-label="취소"]')).toBeNull()
    expect(
      container.querySelector<HTMLButtonElement>('header button[aria-label="로그인"]')?.disabled
    ).toBe(false)
  }
)

it('재실행 조회가 로그인 상태면 계정 메뉴를 표시하지 않고 unmount 때 구독을 해제한다', async () => {
  snapshot = { ...snapshot, phase: 'restoring' }
  await act(async () =>
    root.render(
      <ColorThemeProvider>
        <App />
      </ColorThemeProvider>
    )
  )
  expect(container.querySelector('header')?.textContent).toContain('로그인')
  expect(container.querySelector('header [aria-busy="true"]')).not.toBeNull()
  await act(async () => {
    publish({ phase: 'signedIn', user: { nickname: '복원모험가' }, entry: 'home' })
  })
  expect(container.querySelector('header button[aria-label="로그인"]')).toBeNull()
  await act(async () => root.unmount())
  expect(listeners.size).toBe(0)
  root = createRoot(container)
  await act(async () =>
    root.render(
      <ColorThemeProvider>
        <App />
      </ColorThemeProvider>
    )
  )
  expect(document.body.textContent).not.toContain('내 계정')
  expect(document.body.textContent).not.toContain('복원모험가')
  expect(document.body.textContent).not.toContain('시작하기')
  expect(api.getAuthState).toHaveBeenCalledTimes(2)
  expect(api.beginLogin).not.toHaveBeenCalled()
})

it('인증 연결 실패 중에도 카드, 테마를 유지하고 연결 재확인은 로그인 명령을 보내지 않는다', async () => {
  vi.mocked(api.getAuthState).mockRejectedValueOnce(new Error('test connection unavailable'))
  await act(async () =>
    root.render(
      <ColorThemeProvider>
        <App />
      </ColorThemeProvider>
    )
  )
  const cards = [...container.querySelectorAll('article')]
  await click('로그인')
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(api.getAuthState).toHaveBeenCalledTimes(2)
  expect(api.beginLogin).not.toHaveBeenCalled()
  expect(document.body.textContent).not.toContain('패스키로 계속하기')
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
  await click('라이트 테마')
  expect(document.documentElement.dataset.theme).toBe('light')
  expect([...container.querySelectorAll('article')]).toEqual(cards)
})

it('로그인 설정이 없어 인증 API가 없으면 로그인 버튼 없이 카드와 테마를 표시한다', async () => {
  vi.stubGlobal('auth', undefined)
  await act(async () =>
    root.render(
      <ColorThemeProvider>
        <App />
      </ColorThemeProvider>
    )
  )

  const header = container.querySelector('header')!
  expect(header.querySelector('[aria-label="로그인"]')).toBeNull()
  expect(header.textContent).not.toContain('로그인')
  expect(header.querySelector('[aria-label="라이트 테마"]')).not.toBeNull()
  expect(container.querySelectorAll('article')).toHaveLength(4)
})

it.each(['restorePaused', 'storageBlocked'] as const)(
  '%s에서 기존 복구 명령을 사용하고 카드를 유지한다',
  async (phase) => {
    snapshot = {
      ...snapshot,
      phase,
      notice: phase === 'storageBlocked' ? 'SECURE_STORAGE_UNAVAILABLE' : 'RESTORE_RETRY_REQUIRED'
    }
    await act(async () =>
      root.render(
        <ColorThemeProvider>
          <App />
        </ColorThemeProvider>
      )
    )
    await click('로그인')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(api.retryAuth).toHaveBeenCalledExactlyOnceWith()
    expect(api.beginLogin).not.toHaveBeenCalled()
    expect(container.querySelectorAll('article')).toHaveLength(4)
  }
)

it('새 기본 화면에서 다크, 라이트 테마를 전환하고 창 버튼 색도 함께 바꾼다', async () => {
  const setTheme = vi.fn<WindowChromeApi['setTheme']>(async () => {})
  Object.defineProperty(window, 'windowChrome', { configurable: true, value: { setTheme } })
  try {
    await act(async () =>
      root.render(
        <ColorThemeProvider>
          <App />
        </ColorThemeProvider>
      )
    )
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(setTheme.mock.calls).toEqual([['dark']])

    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="라이트 테마"]')!.click()
    )
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(setTheme.mock.calls).toEqual([['dark'], ['light']])

    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="다크 테마"]')!.click()
    )
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(setTheme.mock.calls).toEqual([['dark'], ['light'], ['dark']])
  } finally {
    Reflect.deleteProperty(window, 'windowChrome')
  }
})

it('검색 하위 메뉴에서 공대를 고르면 공대 자리로 바꾸고 파티로 돌아오면 같은 카드를 보인다', async () => {
  await act(async () =>
    root.render(
      <ColorThemeProvider>
        <App />
      </ColorThemeProvider>
    )
  )
  const cards = [...container.querySelectorAll('article')]
  const trigger = container.querySelector<HTMLButtonElement>('nav button[aria-haspopup="menu"]')!
  expect(trigger.getAttribute('aria-current')).toBe('page')
  expect(trigger.textContent).toBe('검색파티')

  await act(async () => trigger.click())
  const raid = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
    (item) => item.textContent === '공대'
  )!
  await act(async () => raid.click())
  expect(trigger.textContent).toBe('검색공대')
  const raidSection = container.querySelector('section[aria-label="공대"]')!
  expect(raidSection).not.toBeNull()
  // 공대 데이터가 연결되기 전이라 제품은 세 파티 12자리를 모두 빈 카드로 둔다.
  const raidCards = [...raidSection.querySelectorAll('article')]
  expect(raidCards).toHaveLength(12)
  expect(raidCards.every((card) => card.getAttribute('data-state') === 'waiting')).toBe(true)
  expect(
    [...raidSection.querySelectorAll('[role="group"]')].map((group) => group.ariaLabel)
  ).toEqual(['1파티', '2파티', '3파티'])
  expect(container.querySelector('[aria-label="파티 캐릭터"]')!.closest('[hidden]')).not.toBeNull()

  await act(async () => trigger.click())
  const partyItem = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
    (item) => item.textContent === '파티'
  )!
  await act(async () => partyItem.click())
  expect(container.querySelector('section[aria-label="공대"]')).toBeNull()
  expect(container.querySelector('[aria-label="파티 캐릭터"]')!.closest('[hidden]')).toBeNull()
  expect([...container.querySelectorAll('article')]).toEqual(cards)
})

it('파티 머리의 접기 버튼은 카드 영역을 가리키고 접은 뒤 창 높이를 400으로 요청한다', async () => {
  const setContentHeight = vi.fn<WindowChromeApi['setContentHeight']>(async () => {})
  Object.defineProperty(window, 'windowChrome', {
    configurable: true,
    value: { setTheme: vi.fn(async () => {}), setContentHeight }
  })
  try {
    await act(async () =>
      root.render(
        <ColorThemeProvider>
          <App />
        </ColorThemeProvider>
      )
    )
    const fold = container.querySelector<HTMLButtonElement>('[aria-label="카드 접기"]')!
    const cards = container.querySelector('[aria-label="파티 캐릭터"]')!
    expect(fold.getAttribute('aria-expanded')).toBe('true')
    expect(fold.getAttribute('aria-controls')).toBe(cards.id)

    await act(async () => fold.click())
    expect(fold.getAttribute('aria-label')).toBe('카드 펼치기')
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    await vi.waitFor(() => expect(setContentHeight).toHaveBeenCalledExactlyOnceWith(400))
    expect(container.querySelectorAll('article')).toHaveLength(4)
  } finally {
    Reflect.deleteProperty(window, 'windowChrome')
  }
})

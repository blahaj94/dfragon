// @vitest-environment jsdom
import { act, useEffect, type JSX } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi, type Mocked } from 'vitest'
import type {
  AuthSnapshot,
  AuthCommandResult,
  AuthApi
} from '../../../../preload/common/types/auth'
import { useAuthBridge } from './useAuthBridge'
import { LoginPage } from '../../pages/login/LoginPage'

function snapshot(revision: number, runId = 'run-one'): AuthSnapshot {
  return {
    runId,
    revision,
    phase: 'signedOut',
    providers: ['passkey'],
    login: null,
    user: null,
    entry: null,
    notice: null
  }
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}

function createApi(): {
  api: Mocked<AuthApi>
  order: string[]
  listeners: Set<(value: AuthSnapshot) => void>
  retired: ((value: AuthSnapshot) => void)[]
  emit: (value: AuthSnapshot) => void
} {
  const order: string[] = []
  const listeners = new Set<(value: AuthSnapshot) => void>()
  const retired: ((value: AuthSnapshot) => void)[] = []
  const api = {
    getAuthState: vi.fn(async () => {
      order.push('query')
      return snapshot(1)
    }),
    beginLogin: vi.fn<AuthApi['beginLogin']>(async (): Promise<AuthCommandResult> => ({
      ok: true,
      snapshot: snapshot(2)
    })),
    cancelLogin: vi.fn<AuthApi['cancelLogin']>(async (): Promise<AuthCommandResult> => ({
      ok: true,
      snapshot: snapshot(2)
    })),
    retryAuth: vi.fn(async (): Promise<AuthCommandResult> => ({ ok: true, snapshot: snapshot(2) })),
    managePasskeys: vi.fn(),
    logout: vi.fn(async (): Promise<AuthCommandResult> => ({ ok: true, snapshot: snapshot(2) })),
    onAuthStateChanged: vi.fn((listener: (value: AuthSnapshot) => void) => {
      order.push('subscribe')
      listeners.add(listener)
      return () => {
        order.push('unsubscribe')
        listeners.delete(listener)
        retired.push(listener)
      }
    })
  }
  return {
    api,
    order,
    listeners,
    retired,
    emit: (value: AuthSnapshot) => listeners.forEach((listener) => listener(value))
  }
}

let root: Root
let container: HTMLDivElement
let fixture: ReturnType<typeof createApi>
let current: ReturnType<typeof useAuthBridge>
function Probe(): JSX.Element {
  const bridge = useAuthBridge(fixture.api)
  useEffect(() => {
    current = bridge
  }, [bridge])
  return <span>{bridge.snapshot?.revision ?? 'disconnected'}</span>
}
async function mount(): Promise<void> {
  await act(async () => root.render(<Probe />))
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  fixture = createApi()
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

it('subscribe 이후 조회하고 먼저 도착한 높은 event revision을 늦은 reply가 덮지 않는다', async () => {
  const query = deferred<AuthSnapshot>()
  fixture.api.getAuthState.mockImplementation(() => {
    fixture.order.push('query')
    return query.promise
  })
  await mount()
  expect(fixture.order).toEqual(['subscribe', 'query'])
  await act(async () => fixture.emit(snapshot(4)))
  await act(async () => query.resolve(snapshot(1)))
  await act(async () => fixture.emit({ ...snapshot(4), notice: 'LOGIN_CANCELLED' }))
  await act(async () => fixture.emit(snapshot(3)))

  expect(current.snapshot).toEqual(snapshot(4))
})

it('최초 snapshot에서도 phase를 평가하고 presentation epoch를 바꾸지 않는다', async () => {
  let phaseReads = 0
  const initial = {
    ...snapshot(1),
    get phase(): AuthSnapshot['phase'] {
      phaseReads += 1
      return 'signedOut'
    }
  }
  fixture.api.getAuthState.mockResolvedValue(initial)

  await mount()

  expect(phaseReads).toBe(1)
  expect(current.snapshot).toBe(initial)
  expect(current.presentationEpoch).toBe(0)
})

it('stale revision에서는 phase를 평가하지 않고 signedIn 이탈에서만 presentation epoch를 증가시킨다', async () => {
  fixture.api.getAuthState.mockResolvedValue({
    ...snapshot(1),
    phase: 'signedIn',
    user: { nickname: '중립모험가' },
    entry: 'home'
  })
  await mount()

  let phaseReads = 0
  const stale = {
    ...snapshot(0),
    get phase(): AuthSnapshot['phase'] {
      phaseReads += 1
      return 'signedOut'
    }
  }
  await act(async () => fixture.emit(stale))
  expect(phaseReads).toBe(0)
  expect(current.presentationEpoch).toBe(0)

  await act(async () => fixture.emit(snapshot(2)))
  expect(current.presentationEpoch).toBe(1)
})

it('baseline 전 queued event는 같은 run의 오래된 revision을 버리고 run 변경 snapshot으로 덮어쓴다', async () => {
  const query = deferred<AuthSnapshot>()
  fixture.api.getAuthState.mockImplementation(() => {
    fixture.order.push('query')
    return query.promise
  })
  await mount()

  await act(async () => fixture.emit(snapshot(4)))
  await act(async () => fixture.emit(snapshot(3)))
  await act(async () => fixture.emit(snapshot(2, 'run-two')))
  await act(async () => query.resolve(snapshot(1, 'run-two')))

  expect(current.snapshot).toEqual(snapshot(2, 'run-two'))
})

it('commandPending과 exact intent를 전달하고 늦은 command snapshot도 역행하지 않는다', async () => {
  await mount()
  const command = deferred<AuthCommandResult>()
  fixture.api.beginLogin.mockReturnValue(command.promise)
  await act(async () => {
    void current.onIntent({ type: 'beginLogin', provider: 'passkey' })
  })
  expect(current.commandPending).toBe(true)
  expect(fixture.api.beginLogin).toHaveBeenCalledExactlyOnceWith({ provider: 'passkey' })
  await act(async () => fixture.emit(snapshot(5)))
  await act(async () => command.resolve({ ok: true, snapshot: snapshot(2) }))

  expect(current.snapshot).toEqual(snapshot(5))
  expect(current.commandPending).toBe(false)
  await act(async () => {
    void current.onIntent({ type: 'cancelLogin', attemptId: 'current-attempt' })
  })
  await act(async () => {
    void current.onIntent({ type: 'retryAuth' })
  })
  await act(async () => {
    void current.onIntent({ type: 'logout' })
  })
  expect(fixture.api.cancelLogin).toHaveBeenCalledExactlyOnceWith({ attemptId: 'current-attempt' })
  expect(fixture.api.retryAuth).toHaveBeenCalledExactlyOnceWith()
  expect(fixture.api.logout).toHaveBeenCalledExactlyOnceWith()
})

it('응답 유실은 snapshot만 재조회하고 mutation을 자동 재전송하지 않는다', async () => {
  await mount()
  fixture.api.logout.mockRejectedValue(new Error('synthetic transport failure'))
  fixture.api.getAuthState.mockResolvedValue(snapshot(6))
  await act(async () => {
    void current.onIntent({ type: 'logout' })
  })

  expect(fixture.api.logout).toHaveBeenCalledTimes(1)
  expect(fixture.api.getAuthState).toHaveBeenCalledTimes(2)
  expect(current.snapshot).toEqual(snapshot(6))
  expect(current.commandPending).toBe(false)
})

it('실패한 bridge 조회는 인증 snapshot을 만들지 않고 연결 실패를 표시한다', async () => {
  fixture.api.getAuthState.mockRejectedValue(new Error('synthetic transport failure'))
  await mount()

  expect(current.snapshot).toBeNull()
  expect(current.connectionFailed).toBe(true)
  expect(fixture.api.getAuthState).toHaveBeenCalledTimes(1)
  expect(fixture.api.beginLogin).not.toHaveBeenCalled()
})

it('runId 변경은 기존 구독을 버리고 새 조회로 기준을 세우며 이전 listener와 reply를 무시한다', async () => {
  await mount()
  const oldCommand = deferred<AuthCommandResult>()
  fixture.api.logout.mockReturnValue(oldCommand.promise)
  await act(async () => {
    void current.onIntent({ type: 'logout' })
  })
  const query = deferred<AuthSnapshot>()
  fixture.api.getAuthState.mockReturnValue(query.promise)
  await act(async () => fixture.emit(snapshot(0, 'run-two')))

  expect(current.snapshot).toBeNull()
  expect(current.commandPending).toBe(false)
  expect(fixture.api.onAuthStateChanged).toHaveBeenCalledTimes(2)
  expect(fixture.api.getAuthState).toHaveBeenCalledTimes(2)
  expect(fixture.listeners.size).toBe(1)
  expect(fixture.retired).toHaveLength(1)
  await act(async () => query.resolve(snapshot(2, 'run-two')))
  await act(async () => fixture.retired[0](snapshot(999)))
  await act(async () => oldCommand.resolve({ ok: true, snapshot: snapshot(1000) }))

  expect(current.snapshot).toEqual(snapshot(2, 'run-two'))
  expect(fixture.api.onAuthStateChanged).toHaveBeenCalledTimes(2)
})

it('unmount은 listener를 해제하고 late query를 버리며 reload는 새 조회를 수행한다', async () => {
  const oldQuery = deferred<AuthSnapshot>()
  fixture.api.getAuthState.mockReturnValueOnce(oldQuery.promise)
  await mount()
  await act(async () => root.unmount())
  expect(fixture.listeners.size).toBe(0)
  root = createRoot(container)
  await mount()
  await act(async () => oldQuery.resolve(snapshot(999)))
  await act(async () => fixture.retired[0](snapshot(1000)))

  expect(current.snapshot).toEqual(snapshot(1))
  expect(fixture.api.getAuthState).toHaveBeenCalledTimes(2)
  expect(fixture.listeners.size).toBe(1)
})

it('같은 mount에서 api 교체는 이전 계정과 구독을 버리고 새 query 기준을 기다린다', async () => {
  fixture.api.getAuthState.mockResolvedValue({
    ...snapshot(3),
    phase: 'signedIn',
    user: { nickname: '중립모험가' },
    entry: 'home'
  })
  await mount()
  expect(current.snapshot?.phase).toBe('signedIn')
  const previous = fixture
  fixture = createApi()
  const nextQuery = deferred<AuthSnapshot>()
  fixture.api.getAuthState.mockImplementation(() => {
    fixture.order.push('query')
    return nextQuery.promise
  })

  await mount()

  expect(previous.listeners.size).toBe(0)
  expect(current.snapshot).toBeNull()
  expect(current.commandPending).toBe(false)
  expect(fixture.order).toEqual(['subscribe', 'query'])
  await act(async () => nextQuery.resolve(snapshot(1, 'run-two')))
  await act(async () => previous.retired[0](snapshot(999)))
  expect(current.snapshot).toEqual(snapshot(1, 'run-two'))
})

it('A→B→A API 객체 재사용도 이전 연결 snapshot과 늦은 reply를 복원하지 않는다', async () => {
  const apiA = fixture
  apiA.api.getAuthState.mockResolvedValue({
    ...snapshot(3),
    phase: 'signedIn',
    user: { nickname: '중립모험가' },
    entry: 'home'
  })
  await mount()
  const oldCommand = deferred<AuthCommandResult>()
  apiA.api.logout.mockReturnValue(oldCommand.promise)
  await act(async () => {
    current.onIntent({ type: 'logout' })
  })

  fixture = createApi()
  const apiB = fixture
  const queryB = deferred<AuthSnapshot>()
  apiB.api.getAuthState.mockReturnValue(queryB.promise)
  await mount()
  expect(current.snapshot).toBeNull()

  fixture = apiA
  const queryA = deferred<AuthSnapshot>()
  apiA.api.getAuthState.mockReturnValue(queryA.promise)
  await mount()

  expect(current.snapshot).toBeNull()
  expect(current.commandPending).toBe(false)
  expect(apiB.listeners.size).toBe(0)
  await act(async () => {
    queryB.resolve({
      ...snapshot(99, 'run-b'),
      phase: 'signedIn',
      user: { nickname: '중립모험가' },
      entry: 'home'
    })
    oldCommand.resolve({ ok: true, snapshot: snapshot(1000) })
    apiA.retired[0](snapshot(1001))
    apiB.retired[0](snapshot(1002, 'run-b'))
  })
  expect(current.snapshot).toBeNull()
  await act(async () => queryA.resolve(snapshot(4)))
  expect(current.snapshot).toEqual(snapshot(4))
  expect(apiA.listeners.size).toBe(1)
})

it('연결 조회 실패 뒤 화면에서 다시 확인해 현재 로그인으로 복귀한다', async () => {
  fixture.api.getAuthState.mockRejectedValueOnce(new Error('unavailable'))
  await act(async () =>
    root.render(<LoginPage api={fixture.api} home={<span>화면 캡처 기능</span>} />)
  )
  expect(container.textContent).toContain('화면 캡처 기능')
  const retry = container.querySelector('button')
  expect(retry?.textContent).toBe('연결 다시 확인')

  const query = deferred<AuthSnapshot>()
  fixture.api.getAuthState.mockReturnValueOnce(query.promise)
  await act(async () => retry?.click())
  expect(container.textContent).toContain('인증 상태를 확인하고 있습니다')
  expect(container.querySelector('button')).toBeNull()
  expect(fixture.listeners.size).toBe(1)
  const signedIn: AuthSnapshot = {
    ...snapshot(3),
    phase: 'signedIn',
    user: { nickname: '중립모험가' },
    entry: 'home'
  }
  await act(async () => {
    fixture.emit(signedIn)
    query.resolve(snapshot(1))
  })
  expect(container.textContent).toContain('화면 캡처 기능')
  expect(container.textContent).toContain('중립모험가')
  expect(fixture.api.beginLogin).not.toHaveBeenCalled()
  expect(fixture.api.retryAuth).not.toHaveBeenCalled()
  expect(fixture.api.logout).not.toHaveBeenCalled()
})

it('로그인 명령과 재조회 응답 유실 뒤 수동 연결 확인은 로그인 요청을 재전송하지 않는다', async () => {
  await act(async () => root.render(<LoginPage api={fixture.api} />))
  fixture.api.beginLogin.mockRejectedValueOnce(new Error('reply lost'))
  fixture.api.getAuthState.mockRejectedValueOnce(new Error('query lost'))
  await act(async () => container.querySelector('button')?.click())
  expect(fixture.api.beginLogin).toHaveBeenCalledTimes(1)
  expect(container.querySelector('button')?.textContent).toBe('연결 다시 확인')

  fixture.api.getAuthState.mockResolvedValueOnce({
    ...snapshot(3),
    phase: 'waitingBrowser',
    login: { attemptId: 'current-attempt', provider: 'passkey', expiresAt: '2030-01-01T00:10:00Z' }
  })
  await act(async () => container.querySelector('button')?.click())
  expect(container.textContent).toContain('로그인 전용 창')
  expect(container.textContent).toContain('로그인 취소')
  expect(fixture.api.beginLogin).toHaveBeenCalledTimes(1)
  expect(fixture.api.cancelLogin).not.toHaveBeenCalled()
  expect(fixture.api.retryAuth).not.toHaveBeenCalled()
})

it('연결 재확인도 실패하면 실패 안내와 다음 수동 재확인을 유지한다', async () => {
  fixture.api.getAuthState.mockRejectedValue(new Error('unavailable'))
  await act(async () => root.render(<LoginPage api={fixture.api} />))
  await act(async () => container.querySelector('button')?.click())
  expect(fixture.api.getAuthState).toHaveBeenCalledTimes(2)
  expect(container.querySelector('button')?.textContent).toBe('연결 다시 확인')
  expect(fixture.listeners.size).toBe(1)
  expect(fixture.api.beginLogin).not.toHaveBeenCalled()
})

it('계정 확인·환영·로그아웃·연결 재설정 중에도 캡처를 같은 mount로 유지한다', async () => {
  const mounted = vi.fn()
  const cleaned = vi.fn()
  function Capture(): JSX.Element {
    useEffect(() => {
      mounted()
      return cleaned
    }, [])
    return <span>Capture fixture</span>
  }
  const initial = deferred<AuthSnapshot>()
  fixture.api.getAuthState.mockReturnValueOnce(initial.promise)
  await act(async () => root.render(<LoginPage api={fixture.api} home={<Capture />} />))
  expect(container.textContent).toContain('Capture fixture')
  await act(async () => initial.resolve(snapshot(1)))
  await act(async () =>
    fixture.emit({
      ...snapshot(2),
      phase: 'signedIn',
      user: { nickname: 'Synthetic' },
      entry: 'welcome'
    })
  )
  expect(container.textContent).toContain('시작하기')
  await act(async () => fixture.emit({ ...snapshot(3), phase: 'signingOut' }))
  await act(async () => fixture.emit(snapshot(4)))
  fixture.api.getAuthState.mockRejectedValueOnce(new Error('unavailable'))
  await act(async () => fixture.emit(snapshot(1, 'new-run')))
  expect(container.textContent).toContain('연결 다시 확인')
  expect(container.textContent).toContain('Capture fixture')
  expect(mounted).toHaveBeenCalledOnce()
  expect(cleaned).not.toHaveBeenCalled()
})

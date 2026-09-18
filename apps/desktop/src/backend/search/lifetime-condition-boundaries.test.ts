import { expect, it, vi } from 'vitest'
import { createCaptureSearchLifetime, type CaptureBinding } from './capture-lifetime'
import { deferred, FakeClock } from '../auth/auth-test-fixtures'
import type { SearchRuntime } from './request'
import type { SearchSnapshot } from '../../preload/common/types/search'

function binding(): Omit<CaptureBinding, 'captureId'> {
  return { windowGeneration: 2, sourceGeneration: 3 }
}

it('새 관측은 clock read, 이전 transport 취소, binding 검사의 순서를 유지한다', () => {
  const events: string[] = []
  const response = deferred<[]>()
  const clock = {
    read: vi.fn(() => {
      events.push('clock.read')
      return { wallMs: 0, monotonicMs: 1_000, discontinuous: false }
    }),
    schedule: vi.fn(() => () => undefined)
  }
  const isCurrent = vi.fn(() => {
    events.push('isCurrent')
    return true
  })
  const http: SearchRuntime['http'] = vi.fn(({ signal }) => {
    signal.addEventListener('abort', () => events.push('cancelTransport'))
    return response.promise
  })
  const lifetime = createCaptureSearchLifetime({
    publish: vi.fn(),
    isCurrent,
    runtime: { http, clock }
  })
  const captureId = lifetime.begin(binding()).snapshot.captureId!
  lifetime.observe({ captureId, slot: 0, observationRevision: 1, nickname: '가나' })
  events.length = 0

  const result = lifetime.observe({ captureId, slot: 0, observationRevision: 2, nickname: '' })

  expect(result).toMatchObject({
    ok: true,
    snapshot: {
      slots: [
        expect.objectContaining({ state: 'failure' }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      ]
    }
  })
  expect(events.slice(0, 3)).toEqual(['clock.read', 'cancelTransport', 'isCurrent'])
  expect(http).toHaveBeenCalledTimes(1)
  response.resolve([])
})

it('retry는 권한이 없어도 capture와 request ID 비교를 평가한다', () => {
  const events: string[] = []
  const isCurrent = vi.fn(() => true)
  const lifetime = createCaptureSearchLifetime({ publish: vi.fn(), isCurrent })
  const captureId = lifetime.begin(binding()).snapshot.captureId!
  lifetime.observe({ captureId, slot: 0, observationRevision: 1, nickname: '가나' })
  const requestId = lifetime.snapshot().slots[0].requestId!
  isCurrent.mockImplementation(() => {
    events.push('permission')
    return false
  })
  Object.defineProperty(lifetime.current, 'captureId', {
    get: () => {
      events.push('capture')
      return captureId
    }
  })

  const result = lifetime.retry({
    action: 'retry',
    captureId,
    slot: 0,
    get requestId() {
      events.push('requestId')
      return requestId
    }
  })

  expect(result).toMatchObject({ ok: false, error: { code: 'STALE_SEARCH' } })
  expect(events.slice(0, 3)).toEqual(['permission', 'capture', 'requestId'])
})

it('binding이 없을 때도 emit은 revision 증가와 publish를 유지한다', () => {
  const publish = vi.fn<(snapshot: SearchSnapshot) => void>()
  const lifetime = createCaptureSearchLifetime({ publish, isCurrent: vi.fn(() => true) })
  const captureId = lifetime.begin(binding()).snapshot.captureId!
  const before = lifetime.snapshot()
  publish.mockClear()

  const ended = lifetime.end(captureId)

  expect(ended.snapshot.captureId).toBeNull()
  expect(ended.snapshot.revision).toBe(before.revision + 1)
  expect(publish).toHaveBeenCalledTimes(1)
  expect(publish).toHaveBeenLastCalledWith(ended.snapshot)
})

it('pending 발행 중 clear가 발생하면 준비된 actor는 HTTP를 시작하지 않는다', () => {
  const clock = new FakeClock()
  const http = vi.fn(async () => [])
  const lifetime = createCaptureSearchLifetime({
    runtime: { http, clock },
    isCurrent: () => true,
    publish: (snapshot) => {
      if (snapshot.slots[0].state === 'pending') {
        lifetime.clear({
          action: 'clear',
          captureId: snapshot.captureId!,
          slot: 0,
          observationRevision: 2
        })
      }
    }
  })
  const captureId = lifetime.begin(binding()).snapshot.captureId!

  const result = lifetime.observe({ captureId, slot: 0, observationRevision: 1, nickname: '가나' })

  expect(result.snapshot.slots[0]).toMatchObject({ state: 'idle', observationRevision: 2 })
  expect(http).not.toHaveBeenCalled()
  expect(clock.scheduled).toHaveLength(0)
})

it('factory별 요청·취소와 동기 snapshot은 서로 격리된다', async () => {
  const firstResponse = deferred<[]>()
  const secondResponse = deferred<[]>()
  const firstHttp = vi.fn(() => firstResponse.promise)
  const secondHttp = vi.fn(() => secondResponse.promise)
  const first = createCaptureSearchLifetime({
    runtime: { http: firstHttp, clock: new FakeClock() },
    isCurrent: () => true,
    publish: vi.fn()
  })
  const second = createCaptureSearchLifetime({
    runtime: { http: secondHttp, clock: new FakeClock() },
    isCurrent: () => true,
    publish: vi.fn()
  })
  const firstId = first.begin(binding()).snapshot.captureId!
  const secondId = second.begin(binding()).snapshot.captureId!
  first.observe({ captureId: firstId, slot: 0, observationRevision: 1, nickname: '가나' })
  second.observe({ captureId: secondId, slot: 0, observationRevision: 1, nickname: '다라' })
  const secondPending = second.snapshot()

  first.end(firstId)
  firstResponse.resolve([])
  await Promise.resolve()

  expect(first.snapshot().captureId).toBeNull()
  expect(second.snapshot()).toEqual(secondPending)
  secondResponse.resolve([])
  await vi.waitFor(() => expect(second.snapshot().slots[0].state).toBe('empty'))
  expect(first.snapshot().slots[0].state).toBe('idle')
})

it.each([false, true])(
  '같은 nickname의 revision getter는 진행 요청이 있을 때(%s)만 다시 평가한다',
  (pending) => {
    const response = deferred<[]>()
    const lifetime = createCaptureSearchLifetime({
      publish: vi.fn(),
      isCurrent: () => true,
      runtime: pending ? { clock: new FakeClock(), http: () => response.promise } : undefined
    })
    const captureId = lifetime.begin(binding()).snapshot.captureId!
    lifetime.observe({ captureId, slot: 0, observationRevision: 1, nickname: '가나' })
    const readRevision = vi.fn(() => 2)

    lifetime.observe({
      captureId,
      slot: 0,
      nickname: '가나',
      get observationRevision() {
        return readRevision()
      }
    })

    expect(readRevision).toHaveBeenCalledTimes(pending ? 3 : 2)
    expect(lifetime.snapshot().slots[0].observationRevision).toBe(2)
    lifetime.end(captureId)
    response.resolve([])
  }
)

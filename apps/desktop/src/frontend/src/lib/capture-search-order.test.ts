import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  SearchCommandResult,
  SearchSlot,
  SearchSnapshot
} from '../../../preload/common/types/search'
import {
  CAPTURE_ID,
  REQUEST_ID,
  searchSlot,
  searchSnapshot
} from '../../../preload/api/search-test-fixture'
import { inspectCaptureStart } from './capture-search-machine'

const connectionState = vi.hoisted(() => ({
  responses: [] as Array<SearchCommandResult | null | Promise<SearchCommandResult | null>>,
  onCommand: () => {},
  onSnapshot: (() => {}) as (snapshot: SearchSnapshot | null) => void
}))

vi.mock('./search-connection', () => ({
  SearchConnection: class {
    readonly ready = true

    constructor(options: { onSnapshot: (snapshot: SearchSnapshot | null) => void }) {
      connectionState.onSnapshot = options.onSnapshot
    }

    connect(): void {
      return undefined
    }

    command(): Promise<SearchCommandResult | null> {
      connectionState.onCommand()
      return Promise.resolve(connectionState.responses.shift() ?? null)
    }

    dispose(): void {
      return undefined
    }

    invoke(send: () => Promise<SearchCommandResult>): Promise<SearchCommandResult> {
      return send()
    }
  }
}))

const { createCaptureSearch } = await import('./capture-search')
const searches: ReturnType<typeof createCaptureSearch>[] = []

/** IPC snapshot과 signal의 외부 getter 평가 순서를 관측한다. */
function observedSnapshot(prefix: string, events: string[]): SearchSnapshot {
  const snapshot = searchSnapshot()
  return {
    get runId() {
      events.push(`${prefix}.runId`)
      return snapshot.runId
    },
    get revision() {
      events.push(`${prefix}.revision`)
      return snapshot.revision
    },
    get captureId() {
      events.push(`${prefix}.captureId`)
      return snapshot.captureId
    },
    slots: snapshot.slots
  }
}

/** 내부 ticket을 주입하지 않고 공개 begin·observe 호출로 상태를 준비한다. */
function createSearch(onChange = vi.fn()): ReturnType<typeof createCaptureSearch> {
  const search = createCaptureSearch({
    api: { controlCharacterSearch: vi.fn(), onCharacterSearchChanged: vi.fn(() => () => {}) },
    notify: vi.fn(async (): Promise<SearchCommandResult> => ({
      ok: true,
      snapshot: searchSnapshot()
    })),
    onChange,
    onInvalidated: vi.fn()
  })
  searches.push(search)
  return search
}

beforeEach(() => {
  connectionState.responses = []
  connectionState.onCommand = () => {}
})
afterEach(() => searches.splice(0).forEach((search) => search.dispose()))

it('begin 판정은 양쪽 snapshot 비교 뒤 signal을 정확히 한 번 읽는다', () => {
  const events: string[] = []
  const latest = observedSnapshot('latest', events)
  const completed = observedSnapshot('completed', events)
  const signal = {
    get aborted() {
      events.push('signal.aborted')
      return false
    }
  } as AbortSignal

  expect(inspectCaptureStart({ ok: true, snapshot: completed }, latest, signal)).toEqual({
    captureId: CAPTURE_ID,
    cancelled: false
  })
  expect(events).toEqual([
    'completed.captureId',
    'latest.runId',
    'completed.runId',
    'latest.revision',
    'completed.revision',
    'latest.captureId',
    'signal.aborted'
  ])
})

it('begin 판정은 completed가 없으면 latest captureId 뒤 signal만 읽는다', () => {
  const events: string[] = []
  const latest = observedSnapshot('latest', events)
  const signal = {
    get aborted() {
      events.push('signal.aborted')
      return false
    }
  } as AbortSignal

  inspectCaptureStart(null, latest, signal)
  expect(events).toEqual(['latest.captureId', 'signal.aborted'])
})

it('begin 판정은 latest와 completed가 모두 없으면 snapshot getter 없이 signal만 읽는다', () => {
  const events: string[] = []
  const signal = {
    get aborted() {
      events.push('signal.aborted')
      return false
    }
  } as AbortSignal

  inspectCaptureStart(null, null, signal)
  expect(events).toEqual(['signal.aborted'])
})

it('observe는 갱신된 관측을 publish한 뒤 명령을 보낸다', async () => {
  const events: string[] = []
  const search = createSearch(vi.fn(() => events.push('publish')))
  connectionState.responses.push({ ok: true, snapshot: searchSnapshot() })
  await search.begin({ signal: new AbortController().signal })
  events.length = 0
  connectionState.onCommand = () => events.push('command')

  search.observe({ slot: 0, nickname: null })

  expect(events).toEqual(['publish', 'command'])
})

it('retry는 rate-limit retryAfter getter를 양수 대기 검사에서 두 번 읽는다', async () => {
  const events: string[] = []
  const search = createSearch()
  connectionState.responses.push({ ok: true, snapshot: searchSnapshot() })
  await search.begin({ signal: new AbortController().signal })
  search.observe({ slot: 0, nickname: '가나' })
  const error: NonNullable<SearchSlot['error']> = {
    code: 'SEARCH_RATE_LIMITED',
    get retryAfterSeconds() {
      events.push('error.retryAfterSeconds')
      return 2
    }
  }
  connectionState.onSnapshot(
    searchSnapshot({
      slots: [
        searchSlot({ state: 'failure', requestId: REQUEST_ID, error }),
        ...searchSnapshot().slots.slice(1)
      ]
    })
  )

  await search.retry(0)

  expect(events).toEqual(['error.retryAfterSeconds', 'error.retryAfterSeconds'])
})

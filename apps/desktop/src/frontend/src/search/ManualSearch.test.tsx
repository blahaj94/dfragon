// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  ManualSearchApi,
  SearchSnapshot,
  SearchCommandResult
} from '../../../preload/common/types/search'
import {
  CAPTURE_ID,
  searchRow,
  searchSlot,
  searchSnapshot
} from '../../../preload/api/search-test-fixture'
import { ManualSearch } from './ManualSearch'

let root: Root
let container: HTMLDivElement
let current: SearchSnapshot
let listener: (snapshot: SearchSnapshot) => void
let api: ManualSearchApi
let getDisplayMedia: ReturnType<typeof vi.fn>

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  current = searchSnapshot({ captureId: null, revision: 0 })
  api = {
    controlCharacterSearch: vi.fn<ManualSearchApi['controlCharacterSearch']>(async (command) => {
      if (command.action === 'begin') {
        current = searchSnapshot({ revision: current.revision + 1 })
      } else if (command.action === 'clear') {
        current = searchSnapshot({
          revision: current.revision + 1,
          slots: current.slots.map((slot) =>
            slot.slot === 0
              ? {
                  ...slot,
                  observationRevision: command.observationRevision,
                  requestId: null,
                  nickname: null,
                  state: 'idle',
                  rows: [],
                  error: null
                }
              : slot
          )
        })
      }
      return { ok: true, snapshot: current }
    }),
    onCharacterSearchChanged: vi.fn((next) => {
      listener = next
      return vi.fn()
    }),
    notifyManualNickname: vi.fn<ManualSearchApi['notifyManualNickname']>(async (observation) => {
      current = searchSnapshot({
        revision: current.revision + 1,
        slots: [
          searchSlot({
            nickname: observation.nickname,
            observationRevision: observation.observationRevision
          }),
          ...current.slots.slice(1)
        ]
      })
      return { ok: true, snapshot: current }
    })
  }
  getDisplayMedia = vi.fn()
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getDisplayMedia }
  })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

async function mount(): Promise<void> {
  await act(async () => root.render(<ManualSearch api={api} />))
}
async function input(value: string): Promise<void> {
  const input = container.querySelector('input')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function submit(): Promise<void> {
  await act(async () =>
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  )
}
async function result(
  nickname: string,
  revision: number,
  observationRevision: number
): Promise<void> {
  const snapshot = searchSnapshot({
    revision,
    slots: [
      searchSlot({
        nickname,
        observationRevision,
        state: 'success',
        rows: [{ ...searchRow, characterName: nickname }]
      }),
      ...current.slots.slice(1)
    ]
  })
  await act(async () => listener(snapshot))
}

it('starts direct search without source, login or media and forwards typed text unchanged', async () => {
  await mount()
  await input('A B')
  await submit()
  expect(api.controlCharacterSearch).toHaveBeenCalledWith({ action: 'begin' })
  expect(api.notifyManualNickname).toHaveBeenCalledExactlyOnceWith({
    captureId: CAPTURE_ID,
    slot: 0,
    observationRevision: 1,
    nickname: 'A B'
  })
  expect(getDisplayMedia).not.toHaveBeenCalled()
  await result('A B', 5, 1)
  expect(container.textContent).toContain('직접 검색 결과')
  expect(container.textContent).toContain('synthetic-character')
})

it.each(['', 'x', ' ab', 'ab ', 'abcdefghijklmn'])(
  'invalid input %j does not start a search',
  async (value) => {
    await mount()
    await input(value)
    await submit()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      '검색 조건을 확인해 주세요.'
    )
    expect(api.notifyManualNickname).not.toHaveBeenCalled()
    expect(api.controlCharacterSearch).not.toHaveBeenCalledWith({ action: 'begin' })
  }
)

it('a new submit hides previous results and rejects a late previous observation', async () => {
  await mount()
  await input('ALICE')
  await submit()
  await result('ALICE', 3, 1)
  expect(container.textContent).toContain('synthetic-character')
  await input('BOB')
  await submit()
  expect(container.textContent).not.toContain('synthetic-character')
  await result('ALICE', 5, 1)
  expect(container.textContent).not.toContain('synthetic-character')
  await result('BOB', 6, 3)
  expect(container.textContent).toContain('BOB')
  expect(api.controlCharacterSearch).toHaveBeenCalledWith({
    action: 'clear',
    captureId: CAPTURE_ID,
    slot: 0,
    observationRevision: 2
  })
})

it('duplicate form submits share initialization and only the latest edited input searches', async () => {
  const begin = Promise.withResolvers<SearchCommandResult>()
  const control = vi.mocked(api.controlCharacterSearch)
  await mount()
  control.mockReturnValueOnce(begin.promise)
  await input('ALICE')
  await submit()
  await submit()
  await input('BOB')
  await submit()
  await act(async () => begin.resolve({ ok: true, snapshot: searchSnapshot() }))
  expect(control.mock.calls.filter(([command]) => command.action === 'begin')).toHaveLength(1)
  expect(api.notifyManualNickname).toHaveBeenCalledExactlyOnceWith({
    captureId: CAPTURE_ID,
    slot: 0,
    observationRevision: 1,
    nickname: 'BOB'
  })
})

it('invalid replacement clears current observation and unmount ends its own session', async () => {
  await mount()
  await input('ALICE')
  await submit()
  await input('')
  await submit()
  await result('ALICE', 5, 1)
  expect(container.textContent).not.toContain('synthetic-character')
  await act(async () => root.unmount())
  expect(api.controlCharacterSearch).toHaveBeenCalledWith({ action: 'end', captureId: CAPTURE_ID })
  root = createRoot(container)
})

it.each(['success', 'empty'] as const)(
  'resubmits the same nickname after %s while suppressing duplicate pending submits',
  async (state) => {
    await mount()
    await input('ALICE')
    await submit()
    await submit()
    expect(api.notifyManualNickname).toHaveBeenCalledTimes(1)
    current = searchSnapshot({
      revision: current.revision + 1,
      slots: [
        searchSlot({
          nickname: 'ALICE',
          state,
          rows: state === 'success' ? [searchRow] : []
        }),
        ...current.slots.slice(1)
      ]
    })
    await act(async () => listener(current))
    // Dispatch twice before React renders or the new IPC reply arrives.
    await act(async () => {
      for (let i = 0; i < 2; i += 1) {
        container
          .querySelector('form')!
          .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      }
    })
    expect(api.notifyManualNickname).toHaveBeenCalledTimes(2)
    expect(api.notifyManualNickname).toHaveBeenLastCalledWith({
      captureId: CAPTURE_ID,
      slot: 0,
      observationRevision: 3,
      nickname: 'ALICE'
    })
    expect(container.textContent).not.toContain('synthetic-character')
    // A late result from the first request must not unlock the current request.
    await result('ALICE', current.revision + 1, 1)
    await submit()
    expect(api.notifyManualNickname).toHaveBeenCalledTimes(2)
    await result('ALICE', current.revision + 2, 3)
    expect(container.textContent).toContain('synthetic-character')
  }
)

it('same-name submit cannot bypass the rate-limit retry wait', async () => {
  await mount()
  await input('ALICE')
  await submit()
  current = searchSnapshot({
    revision: current.revision + 1,
    slots: [
      searchSlot({
        nickname: 'ALICE',
        state: 'failure',
        error: { code: 'SEARCH_RATE_LIMITED', retryAfterSeconds: 30 }
      }),
      ...current.slots.slice(1)
    ]
  })
  await act(async () => listener(current))
  await submit()
  expect(api.notifyManualNickname).toHaveBeenCalledTimes(1)
  expect(api.controlCharacterSearch).not.toHaveBeenCalledWith(
    expect.objectContaining({ action: 'clear' })
  )
  expect(container.textContent).toContain('30')
})

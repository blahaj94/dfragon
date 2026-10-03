import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Sample } from '../src/model.js'
import type { SplitStatistics } from '../src/split-plan.js'
import { requestOcr } from './client.js'
import { createOcrQueryClient, ocrKeys } from './query.js'
import { INITIAL_SAMPLE_FILTERS } from './sample-query.js'
import { App } from './App.js'

vi.mock('./client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client.js')>()

  return { ...actual, requestOcr: vi.fn() }
})

const first: Sample = {
  id: '11111111-1111-4111-8111-111111111111-1',
  captureId: '11111111-1111-4111-8111-111111111111',
  capturedAt: '2026-10-01T00:00:00.000Z',
  kind: 'hud',
  slot: 1,
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  frameWidth: 1,
  frameHeight: 1,
  uiScale: 1,
  uiScaleSource: 'game',
  text: '기존정답',
  excluded: false,
  split: 'unassigned'
}
const second: Sample = { ...first, id: `${first.captureId}-2`, slot: 2, text: '두번째정답' }
const emptyDistribution: SplitStatistics['total'] = {
  images: 0,
  nicknames: 0,
  characters: 0,
  groups: {
    hangul: 0,
    hiragana: 0,
    katakana: 0,
    hanja: 0,
    latin: 0,
    digit: 0,
    special: 0,
    other: 0
  },
  frequencies: []
}
const total: SplitStatistics['total'] = {
  ...emptyDistribution,
  images: 2,
  nicknames: 2,
  characters: 9,
  groups: { ...emptyDistribution.groups, hangul: 9 },
  frequencies: [
    { character: '답', count: 2, group: 'hangul' },
    { character: '정', count: 2, group: 'hangul' },
    { character: '기', count: 1, group: 'hangul' },
    { character: '두', count: 1, group: 'hangul' },
    { character: '번', count: 1, group: 'hangul' },
    { character: '존', count: 1, group: 'hangul' },
    { character: '째', count: 1, group: 'hangul' }
  ]
}
const splitStats = {
  total,
  splits: {
    train: emptyDistribution,
    val: emptyDistribution,
    test: emptyDistribution,
    unassigned: total
  },
  skipped: 0,
  initialized: false
}
let root: Root
let container: HTMLDivElement
let client: QueryClient
let serverSamples: Sample[]

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers()
  serverSamples = [first, second]
  client = createOcrQueryClient()
  client.setQueryData(ocrKeys.session, true)
  client.setQueryData(ocrKeys.samples(INITIAL_SAMPLE_FILTERS), {
    samples: serverSamples,
    nextOffset: null
  })
  client.setQueryData(ocrKeys.stats, { captures: 1, samples: 2, pending: 0, storedBytes: 68 })
  client.setQueryData(ocrKeys.splitStats, splitStats)
  client.setQueryData(['ocr', 'models'], { models: [] })
  vi.mocked(requestOcr).mockImplementation(async (path) => {
    if (path.startsWith('/api/samples?')) {
      return { samples: serverSamples, nextOffset: null }
    }

    if (path === '/api/stats') {
      return { captures: 1, samples: 2, pending: 0, storedBytes: 68 }
    }

    if (path === '/api/splits/statistics') {
      return splitStats
    }
    throw new Error(`검증에서 정의하지 않은 요청: ${path}`)
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>
    )
  )
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  client.clear()
  vi.resetAllMocks()
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function answerInput() {
  const input = container.querySelector<HTMLInputElement>('section[aria-label="정답 편집"] input')
  if (input === null) {
    throw new Error('정답 편집 입력이 없습니다')
  }

  return input
}
async function changeInput(input: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype =
    input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')!.set!
  await act(async () => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(0)
  })
}
function sampleButton(text: string) {
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>('section[aria-label="수집 이미지"] button')
  ].find((button) => button.querySelector('strong')?.textContent === text)
  if (button === undefined) {
    throw new Error(`표본 버튼이 없습니다: ${text}`)
  }

  return button
}
async function refreshSamples(samples: Sample[]) {
  serverSamples = samples
  await act(async () => {
    client.setQueryData(ocrKeys.samples(INITIAL_SAMPLE_FILTERS), { samples, nextOffset: null })
    await vi.advanceTimersByTimeAsync(0)
  })
}

it('서버 정답·제외·분할 갱신은 작성 중 초안을 유지하고 표본 이동은 선택한 정답으로 시작한다', async () => {
  await changeInput(answerInput(), '작성중')
  await refreshSamples([{ ...first, text: '서버정답', excluded: true, split: 'train' }, second])
  expect(answerInput().value).toBe('작성중')
  expect(sampleButton('서버정답').getAttribute('aria-pressed')).toBe('true')
  await act(async () => sampleButton('두번째정답').click())
  expect(answerInput().value).toBe('두번째정답')
  await act(async () => sampleButton('서버정답').click())
  expect(answerInput().value).toBe('서버정답')
  expect(requestOcr).not.toHaveBeenCalled()
})

it('저장 중 중복 제출을 거절하고 늦은 저장·목록 갱신이 추가로 입력한 초안을 지우지 않는다', async () => {
  let finish!: (value: Sample) => void
  vi.mocked(requestOcr).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  await changeInput(answerInput(), '\u1100\u1161\u1102\u1161')
  await act(async () => {
    const form = container.querySelector('section[aria-label="정답 편집"] form')!
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  const saves = vi.mocked(requestOcr).mock.calls.filter(([, method]) => method === 'PATCH')
  expect(saves).toEqual([
    [`/api/samples/${first.id}`, 'PATCH', { text: '\u1100\u1161\u1102\u1161' }]
  ])
  expect(
    container.querySelector<HTMLButtonElement>('section[aria-label="정답 편집"] form button')
      ?.disabled
  ).toBe(true)
  await changeInput(answerInput(), '다음초안')
  await act(async () => {
    serverSamples = [{ ...first, text: '가나' }, second]
    finish(serverSamples[0])
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(answerInput().value).toBe('다음초안')
  expect(sampleButton('가나')).toBeDefined()
  expect(
    container.querySelector<HTMLButtonElement>('section[aria-label="정답 편집"] form button')
      ?.disabled
  ).toBe(false)
})

it('필터를 바꾼 뒤 이전 목록의 늦은 응답이 현재 선택과 화면을 되돌리지 않는다', async () => {
  let finish!: (value: { samples: Sample[]; nextOffset: null }) => void
  let retiredSignal: AbortSignal | undefined
  vi.mocked(requestOcr).mockImplementationOnce((_path, _method, _body, signal) => {
    retiredSignal = signal

    return new Promise((resolve) => {
      finish = resolve
    })
  })
  const filter = container.querySelector<HTMLSelectElement>('div[aria-label="자료 필터"] select')!
  await changeInput(filter, 'pending')
  expect(container.querySelector('section[aria-label="정답 편집"]')).toBeNull()
  await changeInput(filter, 'labeled')
  expect(retiredSignal?.aborted).toBe(true)
  expect(answerInput().value).toBe('기존정답')
  await act(async () => {
    finish({ samples: [{ ...first, text: null }], nextOffset: null })
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(filter.value).toBe('labeled')
  expect(answerInput().value).toBe('기존정답')
  const gallery = container.querySelector('section[aria-label="수집 이미지"]')!
  expect(gallery.textContent).not.toContain('정답 미작성')
  expect(gallery.querySelector('img[alt="미작성 닉네임"]')).toBeNull()
  const selected = [...gallery.querySelectorAll('button[aria-pressed="true"]')].map(
    (button) => button.querySelector('strong')?.textContent
  )
  expect(selected).toEqual(['기존정답'])
  expect(sampleButton('두번째정답')).toBeDefined()
  expect(vi.mocked(requestOcr).mock.calls.map(([path]) => path)).toEqual([
    '/api/samples?offset=0&state=pending',
    '/api/samples?offset=0&state=labeled'
  ])
})

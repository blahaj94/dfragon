import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { SplitPreview, SplitStatistics } from '../../src/split-plan.js'
import { OCR_ERROR_CODE } from '../../src/errors.js'
import { OcrApiError, requestOcr } from '../client.js'
import { ocrKeys } from '../query.js'
import { useSplitPlanner } from './use-split-planner.js'

vi.mock('../client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client.js')>()

  return { ...actual, requestOcr: vi.fn() }
})
// '가', '나' 두 표본의 독립적인 서버 응답 사례. 분할 구현으로 기대값을 생성하지 않는다.
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
  characters: 2,
  groups: { ...emptyDistribution.groups, hangul: 2 },
  frequencies: [
    { character: '가', count: 1, group: 'hangul' },
    { character: '나', count: 1, group: 'hangul' }
  ]
}
const stats = {
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
const preview: SplitPreview = {
  options: { ratios: { train: 80, val: 10, test: 10 }, replaceExisting: false },
  before: stats,
  after: {
    total,
    splits: {
      train: total,
      val: emptyDistribution,
      test: emptyDistribution,
      unassigned: emptyDistribution
    },
    skipped: 0
  },
  assignments: [
    { text: '가', split: 'train' },
    { text: '나', split: 'train' }
  ],
  preservedUnassignedNicknames: 0,
  changedNicknames: 2,
  reassignedNicknames: 0,
  fingerprint: 'a'.repeat(64),
  initialized: false
}
let root: Root
let client: QueryClient
let planner: ReturnType<typeof useSplitPlanner>
function Harness() {
  const value = useSplitPlanner()
  useEffect(() => {
    planner = value
  }, [value])

  return null
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } }
  })
  client.setQueryData(ocrKeys.splitStats, stats)
  vi.mocked(requestOcr).mockImplementation(async (path) => {
    if (path === '/api/splits/statistics') {
      return stats
    }

    if (path === '/api/splits/preview') {
      return preview
    }
    throw new Error(`검증에서 정의하지 않은 요청: ${path}`)
  })
  root = createRoot(document.createElement('div'))
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    )
  )
})
afterEach(async () => {
  await act(async () => root.unmount())
  client.clear()
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})
async function setRatios(train = '80', val = '10', test = '10') {
  await act(async () => {
    planner.changeRatio('train', train)
    planner.changeRatio('val', val)
    planner.changeRatio('test', test)
  })
}

it('비활성 버튼을 우회해 직접 호출해도 유효한 비율에서만 미리보기를 요청한다', async () => {
  await act(async () => planner.previewSplit())
  for (const { description, ratios } of [
    { description: '공백을 빈 비율로 취급한다', ratios: [' ', '50', '50'] },
    { description: '음수 비율을 거절한다', ratios: ['-1', '51', '50'] },
    { description: '100%를 넘는 비율을 거절한다', ratios: ['101', '0', '0'] },
    { description: '숫자가 아닌 비율을 거절한다', ratios: ['NaN', '50', '50'] },
    { description: '합계 99%는 적용할 수 없다', ratios: ['80', '10', '9'] }
  ]) {
    await setRatios(ratios[0], ratios[1], ratios[2])
    await act(async () => planner.previewSplit())
    expect(requestOcr, description).not.toHaveBeenCalled()
  }
  expect(requestOcr).not.toHaveBeenCalled()
  await setRatios()
  await act(async () => planner.previewSplit())
  expect(requestOcr).toHaveBeenCalledTimes(1)
  expect(requestOcr).toHaveBeenCalledWith('/api/splits/preview', 'POST', {
    ratios: { train: 80, val: 10, test: 10 },
    replaceExisting: false
  })
})

it('미리보기 명령을 즉시 잠그고 처리 중 중복 요청, 적용, 비율 수정을 거절한다', async () => {
  let finish!: (value: SplitPreview) => void
  vi.mocked(requestOcr).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  await setRatios()
  await act(async () => {
    planner.previewSplit()
    planner.previewSplit()
    planner.applySplit(preview)
    planner.changeRatio('train', '90')
    planner.changeReplacement(true)
  })
  expect(requestOcr).toHaveBeenCalledTimes(1)
  expect(planner.ratios.train).toBe('80')
  expect(planner.replaceExisting).toBe(false)
  await act(async () => finish(preview))
  expect(planner.preview).toEqual(preview)
})

it('비율 설정이 바뀌면 이전 미리보기를 거절하고 현재 미리보기의 적용 실패 뒤에는 재적용하지 않는다', async () => {
  await setRatios()
  await act(async () => planner.previewSplit())
  await act(async () => planner.applySplit({ ...preview }))
  expect(requestOcr).toHaveBeenCalledTimes(1)
  await act(async () => {
    planner.changeReplacement(true)
    planner.applySplit(preview)
    planner.previewSplit()
  })
  expect(requestOcr).toHaveBeenCalledTimes(1)
  const replacementPreview: SplitPreview = {
    ...preview,
    options: { ...preview.options, replaceExisting: true },
    fingerprint: 'b'.repeat(64)
  }
  vi.mocked(requestOcr).mockResolvedValueOnce(replacementPreview)
  await act(async () => planner.previewSplit())
  let fail!: (error: Error) => void
  vi.mocked(requestOcr).mockReturnValueOnce(
    new Promise((_, reject) => {
      fail = reject
    })
  )
  await act(async () => {
    planner.applySplit(replacementPreview)
    planner.applySplit(replacementPreview)
    planner.previewSplit()
  })
  expect(requestOcr).toHaveBeenCalledTimes(3)
  expect(requestOcr).toHaveBeenLastCalledWith('/api/splits/apply', 'POST', {
    ratios: { train: 80, val: 10, test: 10 },
    replaceExisting: true,
    fingerprint: 'b'.repeat(64)
  })
  await act(async () => fail(new OcrApiError(OCR_ERROR_CODE.SPLIT_PREVIEW_STALE)))
  await act(async () => planner.applySplit(replacementPreview))
  expect(requestOcr).toHaveBeenCalledTimes(3)
  expect(planner.preview).toBeNull()
})

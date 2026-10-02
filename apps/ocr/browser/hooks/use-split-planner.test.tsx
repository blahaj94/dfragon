import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { planSplits, splitStatistics, type SplitPreview } from '../../src/split-plan.js'
import { requestOcr } from '../client.js'
import { ocrKeys } from '../query.js'
import { useSplitPlanner } from './use-split-planner.js'

vi.mock('../client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client.js')>()

  return { ...actual, requestOcr: vi.fn() }
})
const rows = [
  { id: 'one', text: '가', excluded: false, split: 'unassigned' as const },
  { id: 'two', text: '나', excluded: false, split: 'unassigned' as const }
]
const stats = { ...splitStatistics(rows), initialized: false }
const preview: SplitPreview = {
  ...planSplits(rows, { ratios: { train: 80, val: 10, test: 10 }, replaceExisting: false }),
  fingerprint: 'current-preview',
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
  vi.mocked(requestOcr).mockImplementation(async (path) =>
    path === '/api/splits/statistics' ? stats : preview
  )
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

it('rejects invalid ratios even when callers bypass disabled buttons', async () => {
  await act(async () => planner.previewSplit())
  for (const ratios of [
    [' ', '50', '50'],
    ['-1', '51', '50'],
    ['101', '0', '0'],
    ['NaN', '50', '50'],
    ['80', '10', '9']
  ]) {
    await setRatios(...ratios)
    await act(async () => planner.previewSplit())
  }
  expect(requestOcr).not.toHaveBeenCalled()
  await setRatios()
  await act(async () => planner.previewSplit())
  expect(requestOcr).toHaveBeenCalledTimes(1)
})

it('locks preview immediately and refuses overlapping commands and form changes', async () => {
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

it('applies only the current preview once and retires it after a failed apply', async () => {
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
  await act(async () => planner.previewSplit())
  let fail!: (error: Error) => void
  vi.mocked(requestOcr).mockReturnValueOnce(
    new Promise((_, reject) => {
      fail = reject
    })
  )
  await act(async () => {
    planner.applySplit(preview)
    planner.applySplit(preview)
    planner.previewSplit()
  })
  expect(requestOcr).toHaveBeenCalledTimes(3)
  await act(async () => fail(new Error('stale dataset')))
  await act(async () => planner.applySplit(preview))
  expect(requestOcr).toHaveBeenCalledTimes(3)
  expect(planner.preview).toBeNull()
})

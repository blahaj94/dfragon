import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Sample } from '../../src/model.js'
import { requestOcr } from '../client.js'
import { useSampleEditor } from './use-sample-editor.js'

vi.mock('../client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client.js')>()

  return { ...actual, requestOcr: vi.fn() }
})

const sample: Sample = {
  id: 'one',
  captureId: 'capture',
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
let root: Root
let client: QueryClient
let editor: ReturnType<typeof useSampleEditor>

function Harness({ sample }: { sample: Sample }) {
  const value = useSampleEditor(sample)
  useEffect(() => {
    editor = value
  }, [value])

  return null
}
async function render(value = sample) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Harness key={value.id} sample={value} />
      </QueryClientProvider>
    )
  )
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  root = createRoot(document.createElement('div'))
  vi.mocked(requestOcr).mockResolvedValue(sample)
})
afterEach(async () => {
  await act(async () => root.unmount())
  client.clear()
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

it('follows refreshed answers while pristine but preserves a dirty draft', async () => {
  await render()
  await render({ ...sample, text: '서버정답' })
  expect(editor.text).toBe('서버정답')
  await act(async () => editor.setText('작성중'))
  await render({ ...sample, text: '다른창정답', split: 'train', excluded: true })
  expect(editor.text).toBe('작성중')
  await act(async () => editor.setText('다른창정답'))
  await render({ ...sample, text: '최신정답' })
  expect(editor.text).toBe('최신정답')
})

it('preserves text typed after a save started and resets only when selecting another sample', async () => {
  let finish!: (value: Sample) => void
  vi.mocked(requestOcr).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  await render()
  await act(async () => editor.setText('저장요청'))
  await act(async () => {
    void editor.saveSample(false)
  })
  await act(async () => editor.setText('다음초안'))
  await act(async () => finish({ ...sample, text: '저장요청' }))
  await render({ ...sample, text: '저장요청' })
  expect(editor.text).toBe('다음초안')
  await render({ ...sample, id: 'two', text: '두번째정답' })
  expect(editor.text).toBe('두번째정답')
})

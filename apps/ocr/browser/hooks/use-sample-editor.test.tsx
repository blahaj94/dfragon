import { act, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Sample } from '../../src/model.js'
import { requestOcr, OcrApiError } from '../client.js'
import { OCR_ERROR_CODE } from '../../src/errors.js'
import { SampleEditor } from '../SampleEditor.js'
import { useSampleEditor } from './use-sample-editor.js'
import * as sampleEditorHooks from './use-sample-editor.js'

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
let container: HTMLDivElement
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
  container = document.createElement('div')
  root = createRoot(container)
  vi.mocked(requestOcr).mockResolvedValue(sample)
})
afterEach(async () => {
  await act(async () => root.unmount())
  client.clear()
  vi.resetAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function renderEditor(value = sample) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <SampleEditor key={value.id} sample={value} />
      </QueryClientProvider>
    )
  )
}
async function submitEditor() {
  await act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

it('다른 표본으로 이동한 뒤 이전 저장 응답의 확인 창과 재전송을 취소한다', async () => {
  let reject!: (error: Error) => void
  vi.mocked(requestOcr).mockReturnValueOnce(
    new Promise((_, fail) => {
      reject = fail
    })
  )
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  await renderEditor()
  await submitEditor()
  await renderEditor({ ...sample, id: 'two', text: '두번째정답' })
  await act(async () => reject(new OcrApiError(OCR_ERROR_CODE.LABEL_SPLIT_CHANGE)))
  expect(confirm).not.toHaveBeenCalled()
  expect(requestOcr).toHaveBeenCalledTimes(1)
  expect(container.querySelector('input')?.value).toBe('두번째정답')
  expect(container.textContent).not.toContain('정답 변경을 확인')
})

it('확인 요청을 받은 뒤 표본을 이동하면 보관한 확인으로 재전송하지 않는다', async () => {
  vi.mocked(requestOcr).mockRejectedValueOnce(new OcrApiError(OCR_ERROR_CODE.LABEL_SPLIT_CHANGE))
  await render()
  const previousEditor = editor
  let confirmation: Awaited<ReturnType<typeof editor.saveSample>> = null
  await act(async () => {
    confirmation = await editor.saveSample()
  })
  expect(confirmation).not.toBeNull()
  await render({ ...sample, id: 'two', text: '두번째정답' })
  await act(async () => {
    if (confirmation !== null) {
      await previousEditor.resolveSaveConfirmation(confirmation, true)
    }
  })
  expect(requestOcr).toHaveBeenCalledTimes(1)
  expect(editor.text).toBe('두번째정답')
  expect(editor.message).toBe('')
})

it('확인 결과를 받은 직후 화면이 닫히면 component가 확인 창을 표시하기 전 수명을 다시 검사한다', async () => {
  const useEditor = sampleEditorHooks.useSampleEditor
  let receivedConfirmation = false
  vi.spyOn(sampleEditorHooks, 'useSampleEditor').mockImplementation((sample) => {
    const editor = useEditor(sample)
    function saveSample() {
      const pending = editor.saveSample()
      // 실제 hook의 결과는 그대로 전달하고 component의 await 재개 직전에 화면을 닫는다.
      void pending.then((confirmation) => {
        receivedConfirmation = confirmation !== null
        flushSync(() => root.render(null))
      })

      return pending
    }

    return { ...editor, saveSample }
  })
  vi.mocked(requestOcr).mockRejectedValueOnce(new OcrApiError(OCR_ERROR_CODE.LABEL_SPLIT_CHANGE))
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  await renderEditor()
  await submitEditor()
  expect(receivedConfirmation).toBe(true)
  expect(container.childElementCount).toBe(0)
  expect(confirm).not.toHaveBeenCalled()
  expect(requestOcr).toHaveBeenCalledTimes(1)
})

it.each([
  { description: '승인하면 기존 본문에 분할 변경 확인을 추가해 재전송한다', accepted: true },
  { description: '취소하면 정답 변경을 재전송하지 않는다', accepted: false }
])('현재 표본의 분할 변경 확인을 $description', async ({ accepted }) => {
  vi.mocked(requestOcr).mockRejectedValueOnce(new OcrApiError(OCR_ERROR_CODE.LABEL_SPLIT_CHANGE))
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(accepted)
  await renderEditor()
  await submitEditor()
  expect(confirm).toHaveBeenCalledOnce()
  expect(requestOcr).toHaveBeenCalledTimes(accepted ? 2 : 1)
  if (accepted) {
    expect(requestOcr).toHaveBeenLastCalledWith('/api/samples/one', 'PATCH', {
      text: sample.text,
      confirmSplitChange: true
    })
  }
})

it('미수정 입력은 서버 갱신을 따르고 작성 중인 정답 초안은 보존한다', async () => {
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

it.each([
  { description: '기존 정답과 다른 입력', previous: '기존정답' },
  { description: '기존 정답의 조합형 입력', previous: '가나' }
])('$description 저장은 추가 편집이 없으면 서버의 NFC 정답을 표시한다', async ({ previous }) => {
  const decomposed = '\u1100\u1161\u1102\u1161'
  const saved = { ...sample, text: '가나' }
  vi.mocked(requestOcr).mockResolvedValueOnce(saved)
  await render({ ...sample, text: previous })
  await act(async () => editor.setText(decomposed))
  await act(async () => editor.saveSample())
  await render(saved)
  expect(editor.text).toBe('가나')
})

it('저장 중 추가한 초안은 늦은 NFC 응답에도 유지하고 다른 표본에서는 새 정답으로 시작한다', async () => {
  let finish!: (value: Sample) => void
  vi.mocked(requestOcr).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  await render()
  await act(async () => editor.setText('\u1100\u1161\u1102\u1161'))
  await act(async () => {
    void editor.saveSample()
  })
  await act(async () => editor.setText('다음초안'))
  await act(async () => finish({ ...sample, text: '가나' }))
  await render({ ...sample, text: '가나' })
  expect(editor.text).toBe('다음초안')
  await render({ ...sample, id: 'two', text: '두번째정답' })
  expect(editor.text).toBe('두번째정답')
})

it('제외와 정답은 지정한 필드만 요청하며 빈 정답은 명시적 null로 제거한다', async () => {
  await render()
  await act(async () => editor.setText('미저장초안'))
  await act(async () => editor.setSampleExcluded(true))
  expect(requestOcr).toHaveBeenLastCalledWith('/api/samples/one', 'PATCH', { excluded: true })
  expect(editor.text).toBe('미저장초안')
  await render({ ...sample, text: '다른창의정답', excluded: true })
  expect(editor.text).toBe('미저장초안')
  await act(async () => editor.saveSample())
  expect(requestOcr).toHaveBeenLastCalledWith('/api/samples/one', 'PATCH', { text: '미저장초안' })
  await act(async () => editor.setSampleExcluded(false))
  expect(requestOcr).toHaveBeenLastCalledWith('/api/samples/one', 'PATCH', { excluded: false })
  await act(async () => editor.setText(''))
  await act(async () => editor.saveSample())
  expect(requestOcr).toHaveBeenLastCalledWith('/api/samples/one', 'PATCH', { text: null })
})

it('정답 저장이 시작되면 같은 렌더의 중복 저장·제외·분할 명령을 거절한다', async () => {
  let finish!: (value: Sample) => void
  vi.mocked(requestOcr).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  await render()
  await act(async () => {
    void editor.saveSample()
    void editor.saveSample()
    void editor.setSampleExcluded(true)
    editor.assignNicknameSplit('train')
  })
  expect(requestOcr).toHaveBeenCalledTimes(1)
  expect(requestOcr).toHaveBeenCalledWith('/api/samples/one', 'PATCH', { text: '기존정답' })
  await act(async () => finish(sample))
  expect(editor.busy).toBe(false)
})

it('분할 변경이 시작되면 같은 렌더의 중복 분할·정답 저장·제외 명령을 거절한다', async () => {
  let finish!: (value: unknown) => void
  vi.mocked(requestOcr).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  await render()
  await act(async () => {
    editor.assignNicknameSplit('val')
    editor.assignNicknameSplit('test')
    void editor.saveSample()
    void editor.setSampleExcluded(true)
  })
  expect(requestOcr).toHaveBeenCalledTimes(1)
  expect(requestOcr).toHaveBeenCalledWith('/api/splits', 'PUT', { text: '기존정답', split: 'val' })
  await act(async () => finish({ text: '기존정답', split: 'val' }))
  expect(editor.busy).toBe(false)
})

it.each([
  { description: '성공', succeeded: true },
  { description: '실패', succeeded: false }
])(
  '분할 변경 $description 뒤 잠금이 반환되어 정답·제외·다음 분할을 요청할 수 있다',
  async ({ succeeded }) => {
    let finish!: (value: unknown) => void
    let fail!: (error: Error) => void
    vi.mocked(requestOcr).mockReturnValueOnce(
      new Promise((resolve, reject) => {
        finish = resolve
        fail = reject
      })
    )
    await render()
    await act(async () => editor.assignNicknameSplit('val'))
    await act(async () => {
      if (succeeded) {
        finish({ text: '기존정답', split: 'val' })
      } else {
        fail(new OcrApiError(OCR_ERROR_CODE.UNAVAILABLE))
      }
    })
    const split = succeeded ? 'val' : 'unassigned'
    await render({ ...sample, split })
    vi.mocked(requestOcr).mockResolvedValueOnce({ ...sample, split })
    await act(async () => editor.saveSample())
    vi.mocked(requestOcr).mockResolvedValueOnce({ ...sample, split, excluded: true })
    await act(async () => editor.setSampleExcluded(true))
    vi.mocked(requestOcr).mockResolvedValueOnce({ text: '기존정답', split: 'train' })
    await act(async () => editor.assignNicknameSplit('train'))
    expect(vi.mocked(requestOcr).mock.calls).toEqual([
      ['/api/splits', 'PUT', { text: '기존정답', split: 'val' }],
      ['/api/samples/one', 'PATCH', { text: '기존정답' }],
      ['/api/samples/one', 'PATCH', { excluded: true }],
      ['/api/splits', 'PUT', { text: '기존정답', split: 'train' }]
    ])
  }
)

it('저장하지 않은 초안으로 분할을 바꾸거나 현재 분할을 다시 요청하지 않는다', async () => {
  await render()
  await act(async () => editor.assignNicknameSplit('unassigned'))
  await act(async () => editor.setText('작성중'))
  await act(async () => editor.assignNicknameSplit('train'))
  expect(requestOcr).not.toHaveBeenCalled()
  expect(editor.text).toBe('작성중')
})

it('분할 확인 재전송은 최초 정답을 유지하고 그 이후 초안은 지우지 않는다', async () => {
  vi.mocked(requestOcr)
    .mockRejectedValueOnce(new OcrApiError(OCR_ERROR_CODE.LABEL_SPLIT_CHANGE))
    .mockResolvedValueOnce({ ...sample, text: '최초정답', split: 'val' })
  await render()
  await act(async () => editor.setText('최초정답'))
  let confirmation: Awaited<ReturnType<typeof editor.saveSample>> = null
  await act(async () => {
    confirmation = await editor.saveSample()
  })
  expect(confirmation).not.toBeNull()
  await act(async () => editor.setText('다음초안'))
  await act(async () => {
    if (confirmation !== null) {
      await editor.resolveSaveConfirmation(confirmation, true)
      await editor.resolveSaveConfirmation(confirmation, true)
    }
  })
  expect(requestOcr).toHaveBeenCalledTimes(2)
  expect(requestOcr).toHaveBeenLastCalledWith('/api/samples/one', 'PATCH', {
    text: '최초정답',
    confirmSplitChange: true
  })
  expect(editor.text).toBe('다음초안')
})

it.each([
  { description: '저장 성공', result: 'success' },
  { description: '저장 실패', result: 'failure' }
])('표본 이동 뒤 늦은 $description 응답은 새 정답과 안내를 바꾸지 않는다', async ({ result }) => {
  let finish!: (value: Sample) => void
  let fail!: (error: Error) => void
  vi.mocked(requestOcr).mockReturnValueOnce(
    new Promise((resolve, reject) => {
      finish = resolve
      fail = reject
    })
  )
  await render()
  await act(async () => editor.setText('이전표본수정'))
  await act(async () => {
    void editor.saveSample()
  })
  await render({ ...sample, id: 'two', text: '두번째정답' })
  await act(async () => {
    if (result === 'success') {
      finish({ ...sample, text: '이전표본수정' })
    } else {
      fail(new OcrApiError(OCR_ERROR_CODE.UNAVAILABLE))
    }
  })
  expect(editor.text).toBe('두번째정답')
  expect(editor.message).toBe('')
  expect(requestOcr).toHaveBeenCalledTimes(1)
})

// @vitest-environment jsdom

import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  CAPTURE_ID,
  REQUEST_ID,
  invalidSearchSnapshots,
  searchRow,
  searchSnapshot,
  searchSlot
} from '../../../preload/api/search-test-fixture'
import type { WindowFrameResult } from '../../../preload/common/types/capture'
import type {
  SearchCommandResult,
  SearchControl,
  SearchSnapshot
} from '../../../preload/common/types/search'
import * as diagnostics from '../lib/runtime-diagnostics'
import { usePartyCapture } from './usePartyCapture'

const moduleMocks = vi.hoisted(() => {
  const capturePartyRecognitionInputs = vi.fn()
  const createPartyOcrWorker = vi.fn()

  return {
    capturePartyRecognitionInputs,
    createPartyOcrWorker
  }
})

vi.mock('../lib/ocr', async (importOriginal) => {
  const ocr = { ...(await importOriginal<typeof import('../lib/ocr')>()) }
  ocr.createPartyOcrWorker = moduleMocks.createPartyOcrWorker

  return ocr
})

vi.mock('../lib/party', async (importOriginal) => {
  const party = { ...(await importOriginal<typeof import('../lib/party')>()) }
  party.capturePartyRecognitionInputs = moduleMocks.capturePartyRecognitionInputs

  return party
})

type HookValue = ReturnType<typeof usePartyCapture>

const api = {
  listCaptureSources: vi.fn(),
  notifyOcrCandidatesDetected: vi.fn(),
  selectCaptureSource: vi.fn(),
  readCaptureFrame: (...args: unknown[]) => readCaptureFrame(...args),
  onDesktopShortcut: vi.fn()
}

const search = { controlCharacterSearch: vi.fn(), onCharacterSearchChanged: vi.fn() }
let currentSearch = searchSnapshot({ captureId: null, revision: 0 })
const readCaptureFrame = vi.fn()

function HookHarness({ onRender }: { onRender: (value: HookValue) => void }): null {
  onRender(usePartyCapture({ receivesShortcut: true }))

  return null
}

async function renderPartyCaptureHook(strict = false): Promise<{
  getCurrent: () => HookValue
  unmount: () => Promise<void>
}> {
  const container = document.createElement('div')
  const root: Root = createRoot(container)
  let current: HookValue | undefined

  await act(async () => {
    const harness = <HookHarness onRender={(value) => (current = value)} />
    root.render(strict ? <StrictMode>{harness}</StrictMode> : harness)
  })

  return {
    getCurrent: () => {
      const value = current
      const hasCurrent = value != null
      if (!hasCurrent) {
        throw new Error('Hook did not render.')
      }

      return value
    },
    unmount: async () => {
      await act(async () => root.unmount())
    }
  }
}

async function flushPromises(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function captureResources(): {
  frame: WindowFrameResult
  worker: { recognize: ReturnType<typeof vi.fn>; terminate: ReturnType<typeof vi.fn> }
} {
  const frame: WindowFrameResult = {
    kind: 'frame',
    image: { width: 2, height: 1, rgba: new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255]) }
  }
  const worker = {
    recognize: vi.fn().mockResolvedValue(ocrResult('Alice')),
    terminate: vi.fn().mockResolvedValue(undefined)
  }

  return { frame, worker }
}

beforeEach(() => {
  vi.resetAllMocks()
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true
  })
  Object.defineProperty(window, 'api', { configurable: true, value: api })
  Object.defineProperty(window, 'desktopShortcut', {
    configurable: true,
    value: { onDesktopShortcut: api.onDesktopShortcut }
  })
  Object.defineProperty(window, 'search', { configurable: true, value: search })
  currentSearch = searchSnapshot({ captureId: null, revision: 0 })
  search.onCharacterSearchChanged.mockReturnValue(() => {})
  search.controlCharacterSearch.mockImplementation(async (control: SearchControl) => {
    const isBegin = control.action === 'begin'
    if (isBegin && currentSearch.captureId !== null) {
      return { ok: false, error: { code: 'SEARCH_BUSY' }, snapshot: currentSearch }
    }
    const isCurrentEnd = control.action === 'end' && control.captureId === currentSearch.captureId
    const shouldChangeCapture = isBegin || isCurrentEnd
    if (shouldChangeCapture) {
      currentSearch = searchSnapshot({
        captureId: isBegin ? CAPTURE_ID : null,
        revision: currentSearch.revision + 1
      })
    }

    return { ok: true, snapshot: currentSearch }
  })

  api.onDesktopShortcut.mockReturnValue(() => {})
  api.listCaptureSources.mockResolvedValue([])
  api.notifyOcrCandidatesDetected.mockImplementation(async () => ({
    ok: true,
    snapshot: currentSearch
  }))
  api.selectCaptureSource.mockResolvedValue(null)
  moduleMocks.capturePartyRecognitionInputs.mockReturnValue([null, null, null, null])
  const resources = captureResources()
  readCaptureFrame.mockResolvedValue(resources.frame)
  moduleMocks.createPartyOcrWorker.mockResolvedValue(resources.worker)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('새로고침으로 나중에 열린 창을 표시하며 기존 선택을 유지한다', async () => {
  const initialSource = { id: 'initial-window', name: 'Initial window' }
  const gameSource = { id: 'later-window', name: 'Later game window' }
  api.listCaptureSources.mockResolvedValueOnce([initialSource])
  const hook = await renderPartyCaptureHook()
  await act(async () => hook.getCurrent().source.selectSource(initialSource.id))
  api.selectCaptureSource.mockClear()
  api.listCaptureSources.mockResolvedValueOnce([initialSource, gameSource])

  await act(async () => hook.getCurrent().source.refreshSources())

  expect(hook.getCurrent().source.sources).toEqual([initialSource, gameSource])
  expect(hook.getCurrent().source.selectedSourceId).toBe(initialSource.id)
  expect(hook.getCurrent().canStartCapture).toBe(true)
  expect(api.selectCaptureSource).not.toHaveBeenCalled()
  await hook.unmount()
})

it('새로고침 뒤에 도착한 이전 목록은 최신 창 목록을 덮어쓰지 않는다', async () => {
  const initialList = Promise.withResolvers<{ id: string; name: string }[]>()
  api.listCaptureSources.mockReturnValueOnce(initialList.promise)
  const hook = await renderPartyCaptureHook()
  const gameSource = { id: 'later-window', name: 'Later game window' }
  api.listCaptureSources.mockResolvedValueOnce([gameSource])
  await act(async () => hook.getCurrent().source.refreshSources())

  initialList.resolve([{ id: 'old-window', name: 'Old window' }])
  await flushPromises()

  expect(hook.getCurrent().source.sources).toEqual([gameSource])
  await hook.unmount()
})

it('창 목록 오류는 캡처 상태와 분리하고 창 선택 실패는 복구 안내를 표시한다', async () => {
  api.listCaptureSources.mockRejectedValueOnce(new Error('synthetic internal detail'))
  const hook = await renderPartyCaptureHook()
  expect(hook.getCurrent().source.sourcesFailed).toBe(true)
  expect(hook.getCurrent().status).toBe('캡처할 게임 창을 선택해 주세요.')
  api.listCaptureSources.mockResolvedValueOnce([{ id: 'game', name: 'Synthetic window' }])
  await act(async () => hook.getCurrent().source.refreshSources())
  expect(hook.getCurrent().source.sourcesFailed).toBe(false)
  expect(hook.getCurrent().status).toBe('캡처할 게임 창을 선택해 주세요.')

  api.selectCaptureSource.mockRejectedValueOnce(new Error('synthetic internal detail'))
  await act(async () => hook.getCurrent().source.selectSource('synthetic-window'))
  expect(hook.getCurrent().status).toBe('게임 창을 선택하지 못했습니다. 창을 다시 선택해 주세요.')
  expect(hook.getCurrent().canStartCapture).toBe(false)
  await hook.unmount()
})

it('loads sources and registers only the latest selection', async () => {
  api.listCaptureSources.mockResolvedValue([
    { id: 'old', name: 'Old window' },
    { id: 'new', name: 'New window' }
  ])
  const oldSelection = Promise.withResolvers<null>()
  const newSelection = Promise.withResolvers<null>()
  api.selectCaptureSource.mockImplementation((sourceId: string) => {
    const isOldSource = sourceId === 'old'
    if (isOldSource) {
      return oldSelection.promise
    }

    return newSelection.promise
  })

  const hook = await renderPartyCaptureHook()
  await flushPromises()

  expect(hook.getCurrent().source.sources).toEqual([
    { id: 'old', name: 'Old window' },
    { id: 'new', name: 'New window' }
  ])

  act(() => hook.getCurrent().source.selectSource('old'))
  act(() => hook.getCurrent().source.selectSource('new'))
  await act(async () => hook.getCurrent().startRound())

  expect(hook.getCurrent().status).toBe('게임 창 선택을 확인하고 있습니다.')

  oldSelection.resolve(null)
  await flushPromises()
  expect(hook.getCurrent().canStartCapture).toBe(false)

  newSelection.resolve(null)
  await flushPromises()
  expect(hook.getCurrent().source.selectedSourceId).toBe('new')
  expect(hook.getCurrent().phase).toBe('selected')
  expect(hook.getCurrent().canStartCapture).toBe(true)

  await hook.unmount()
})

function ocrResult(...names: string[]) {
  return {
    data: {
      text: names[0] ?? '',
      confidence: 0.1,
      candidates: names.map((nickname, index) => ({ nickname, rank: index + 1, modelScore: 0.1 }))
    }
  }
}

function setSlots(...slots: number[]) {
  const inputs = Array.from({ length: 4 }, (_, slot) => {
    if (!slots.includes(slot)) {
      return null
    }

    return {
      slot,
      nickname: document.createElement('canvas'),
      portrait: {
        image: { width: 1, height: 1, rgba: new Uint8Array([slot, 2, 3, 255]) },
        rasterScale: 1
      }
    }
  })
  moduleMocks.capturePartyRecognitionInputs.mockReturnValue(inputs)

  return inputs
}

function beginCalls() {
  return search.controlCharacterSearch.mock.calls.filter(([command]) => command.action === 'begin')
}

async function shortcut() {
  await act(async () => api.onDesktopShortcut.mock.lastCall![0]('restart-search'))
}

async function emit(snapshot: SearchSnapshot) {
  currentSearch = snapshot
  await act(async () => search.onCharacterSearchChanged.mock.lastCall![0](snapshot))
}

function endCalls() {
  return search.controlCharacterSearch.mock.calls.filter(([command]) => command.action === 'end')
}

function beginNextCapture(captureId: string) {
  search.controlCharacterSearch.mockImplementationOnce(async (command: SearchControl) => {
    expect(command.action).toBe('begin')
    currentSearch = searchSnapshot({ captureId, revision: currentSearch.revision + 1 })

    return { ok: true, snapshot: currentSearch }
  })
}

const NEXT_CAPTURE_ID = '00000000-0000-4000-8000-000000000099'

it.each(['선택', '자동 감지', '나중에 자동 감지'] as const)(
  '%s는 창만 등록하고 Alt+R 뒤에 검색과 프레임 읽기를 시작한다',
  async (mode) => {
    vi.useFakeTimers()
    if (mode === '자동 감지') {
      api.listCaptureSources.mockResolvedValue([{ id: 'dnf', name: '던전앤파이터' }])
    }
    const hook = await renderPartyCaptureHook()
    if (mode === '선택') {
      await act(async () => hook.getCurrent().source.selectSource('dnf'))
    } else if (mode === '나중에 자동 감지') {
      api.listCaptureSources.mockResolvedValue([{ id: 'dnf', name: '던전앤파이터' }])
      await act(async () => vi.advanceTimersByTimeAsync(15_000))
    }
    expect(api.selectCaptureSource).toHaveBeenCalledWith('dnf')
    expect(hook.getCurrent().phase).toBe('selected')
    expect(hook.getCurrent().status).toBe('Alt+R을 눌러 파티를 인식해 주세요.')
    expect(beginCalls()).toHaveLength(0)
    expect(readCaptureFrame).not.toHaveBeenCalled()
    await shortcut()
    expect(beginCalls()).toHaveLength(1)
    expect(readCaptureFrame).toHaveBeenCalledExactlyOnceWith(CAPTURE_ID)
    await hook.unmount()
  }
)

it('던파 창이 여러 개면 자동으로 선택하지 않는다', async () => {
  api.listCaptureSources.mockResolvedValue([
    { id: 'one', name: '던전앤파이터' },
    { id: 'two', name: '던전앤파이터' }
  ])
  const hook = await renderPartyCaptureHook()
  expect(api.selectCaptureSource).not.toHaveBeenCalled()
  expect(hook.getCurrent().source.selectedSourceId).toBe('')
  await hook.unmount()
})

it('네 슬롯을 첫 프레임으로 한 번 처리하고 완료 뒤에는 재시도해도 추가 캡처하지 않는다', async () => {
  vi.useFakeTimers()
  const { frame, worker } = captureResources()
  readCaptureFrame.mockResolvedValue(frame)
  moduleMocks.createPartyOcrWorker.mockResolvedValue(worker)
  const inputs = setSlots(0, 1, 2, 3)
  worker.recognize.mockImplementation(async (crop) => {
    const slot = inputs.findIndex((input) => input?.nickname === crop)

    return ocrResult(` 이름${slot} `, '다른후보')
  })
  const hook = await renderPartyCaptureHook()
  await act(async () => hook.getCurrent().source.selectSource('game'))
  await shortcut()
  expect(readCaptureFrame).toHaveBeenCalledExactlyOnceWith(CAPTURE_ID)
  expect(moduleMocks.capturePartyRecognitionInputs).toHaveBeenCalledExactlyOnceWith(
    frame.kind === 'frame' ? frame.image : {}
  )
  expect(worker.recognize.mock.calls.map(([crop]) => crop)).toEqual(
    inputs.map((input) => input!.nickname)
  )
  expect(api.notifyOcrCandidatesDetected.mock.calls.map(([input]) => input)).toEqual(
    inputs.map((input, slot) => ({
      captureId: CAPTURE_ID,
      slot,
      observationRevision: 1,
      nickname: `이름${slot}`,
      candidateNicknames: [`이름${slot}`],
      portrait: input!.portrait
    }))
  )
  expect(hook.getCurrent().nicknames).toEqual(['이름0', '이름1', '이름2', '이름3'])
  expect(hook.getCurrent().phase).toBe('complete')
  expect(hook.getCurrent().status).toBe('인식을 마쳤습니다. 다시 인식하려면 Alt+R을 누르세요.')
  expect(worker.terminate).toHaveBeenCalledOnce()
  currentSearch = searchSnapshot({
    revision: currentSearch.revision + 1,
    slots: [
      searchSlot({
        nickname: '이름0',
        state: 'failure',
        error: { code: 'SEARCH_TIMEOUT', retryAfterSeconds: null }
      }),
      ...currentSearch.slots.slice(1)
    ]
  })
  await act(async () => search.onCharacterSearchChanged.mock.lastCall![0](currentSearch))
  expect(hook.getCurrent().search.slots[0].state).toBe('failure')
  await act(async () => hook.getCurrent().search.retry(0))
  expect(search.controlCharacterSearch).toHaveBeenCalledWith({
    action: 'retry',
    captureId: CAPTURE_ID,
    slot: 0,
    requestId: REQUEST_ID
  })
  await act(async () => vi.advanceTimersByTimeAsync(60_000))
  expect(readCaptureFrame).toHaveBeenCalledOnce()
  expect(worker.recognize).toHaveBeenCalledTimes(4)
  expect(search.controlCharacterSearch).not.toHaveBeenCalledWith({
    action: 'end',
    captureId: CAPTURE_ID
  })
  await shortcut()
  expect(readCaptureFrame).toHaveBeenCalledTimes(2)
  expect(endCalls()).toEqual([[{ action: 'end', captureId: CAPTURE_ID }]])
  await hook.unmount()
})

it.each([
  ['covered', '게임 창이 가려져 있습니다. 게임 창을 앞으로 가져온 뒤 Alt+R을 누르세요.'],
  [
    'unavailable',
    '게임 화면을 읽지 못했습니다. 창이 최소화되지 않았는지 확인한 뒤 Alt+R을 누르세요.'
  ],
  ['missing', '파티 프레임을 찾지 못했습니다. 파티 프레임이 보이게 한 뒤 Alt+R을 누르세요.']
] as const)('%s 프레임은 다시 읽지 않고 Alt+R을 기다린다', async (reason, status) => {
  vi.useFakeTimers()
  if (reason !== 'missing') {
    readCaptureFrame.mockResolvedValueOnce({ kind: 'waiting', reason })
  }
  const hook = await renderPartyCaptureHook()
  await act(async () => hook.getCurrent().source.selectSource('game'))
  await shortcut()
  expect(hook.getCurrent().phase).toBe('unavailable')
  expect(hook.getCurrent().status).toBe(status)
  expect(api.notifyOcrCandidatesDetected).not.toHaveBeenCalled()
  expect(moduleMocks.createPartyOcrWorker).toHaveBeenCalledTimes(reason === 'missing' ? 1 : 0)
  await act(async () => vi.advanceTimersByTimeAsync(60_000))
  expect(readCaptureFrame).toHaveBeenCalledOnce()
  setSlots(0)
  await shortcut()
  expect(beginCalls()).toHaveLength(2)
  expect(readCaptureFrame).toHaveBeenCalledTimes(2)
  expect(hook.getCurrent().phase).toBe('complete')
  expect(endCalls()).toEqual([[{ action: 'end', captureId: CAPTURE_ID }]])
  await act(async () => hook.getCurrent().stopCapture())
  expect(endCalls()).toHaveLength(2)
  await hook.unmount()
})

it('일부 슬롯 미검출은 그 슬롯만 비우고 나머지는 한 번 통지한다', async () => {
  setSlots(0, 2, 3)
  const hook = await renderPartyCaptureHook()
  await act(async () => hook.getCurrent().source.selectSource('game'))
  await shortcut()
  expect(hook.getCurrent().nicknames).toEqual(['Alice', null, 'Alice', 'Alice'])
  expect(api.notifyOcrCandidatesDetected.mock.calls.map(([input]) => input.slot)).toEqual([0, 2, 3])
  await hook.unmount()
})

it.each([
  [[], '이유: 후보 없음, 원문: 없음'],
  [['', '정상'], '이유: 빈 문자열, 원문: ""'],
  [['  ', '정상'], '이유: 빈 문자열, 원문: "  "'],
  [['a'.repeat(13), '정상'], '이유: 최대 길이 초과, 원문: "aaaaaaaaaaaaa"'],
  [['\uD800', '정상'], '이유: 잘못된 Unicode, 원문: "\\ud800"']
])('잘못된 첫 후보 %j는 실패 통지와 Console 표시를 유지한다', async (names, message) => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const { worker } = captureResources()
  worker.recognize.mockResolvedValue(ocrResult(...names))
  moduleMocks.createPartyOcrWorker.mockResolvedValue(worker)
  setSlots(0)
  const hook = await renderPartyCaptureHook()
  await act(async () => hook.getCurrent().source.selectSource('game'))
  await shortcut()
  expect(api.notifyOcrCandidatesDetected).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ nickname: '', candidateNicknames: [''] })
  )
  expect(warn).toHaveBeenCalledExactlyOnceWith(expect.stringContaining(message))
  expect(hook.getCurrent().nicknames).toEqual([null, null, null, null])
  await hook.unmount()
})

it.each(['idle', 'selecting', 'selectionFailed', 'stopped'] as const)(
  '%s에서 Alt+R은 무시한다',
  async (state) => {
    const pending = Promise.withResolvers<null>()
    const hook = await renderPartyCaptureHook()
    if (state === 'selecting') {
      api.selectCaptureSource.mockReturnValueOnce(pending.promise)
    }

    if (state === 'selectionFailed') {
      api.selectCaptureSource.mockRejectedValueOnce(new Error('selection failed'))
    }

    if (state !== 'idle') {
      await act(async () => hook.getCurrent().source.selectSource('game'))
    }

    if (state === 'stopped') {
      await act(async () => hook.getCurrent().stopCapture())
    }
    await shortcut()
    expect(beginCalls()).toHaveLength(0)
    expect(readCaptureFrame).not.toHaveBeenCalled()
    expect(hook.getCurrent().canStartCapture).toBe(false)
    pending.resolve(null)
    await flushPromises()
    if (state === 'stopped') {
      await act(async () => hook.getCurrent().source.selectSource('game'))
      expect(readCaptureFrame).not.toHaveBeenCalled()
      await shortcut()
      expect(beginCalls()).toHaveLength(1)
    }
    await hook.unmount()
  }
)

it.each([
  ['begin', '검색을 시작하지 못했습니다. 창을 다시 선택해 주세요.', 'CAPTURE_START_FAILED'],
  ['frame', '캡처 연결이 종료되었습니다. 창을 다시 선택해 주세요.', 'CAPTURE_READ_FAILED'],
  ['unsupported', '화면 캡처는 Windows에서 사용할 수 있습니다.', 'CAPTURE_READ_FAILED'],
  ['worker', '글자 인식을 준비하지 못했습니다. Alt+R을 눌러 다시 인식해 주세요.', 'OCR_FAILED'],
  [
    'ocr',
    '글자 인식에 실패했습니다. Alt+R을 누르거나 캐릭터 직접 검색을 사용해 주세요.',
    'OCR_FAILED'
  ]
] as const)(
  '%s 실패는 진단과 자원 정리를 유지하고 Alt+R로 재시작한다',
  async (stage, status, code) => {
    const report = vi.spyOn(diagnostics, 'reportRendererDiagnostic')
    const { worker } = captureResources()
    moduleMocks.createPartyOcrWorker.mockResolvedValue(worker)
    setSlots(0)
    const hook = await renderPartyCaptureHook()
    await act(async () => hook.getCurrent().source.selectSource('game'))
    if (stage === 'begin') {
      search.controlCharacterSearch.mockRejectedValueOnce(new Error('internal detail'))
    }

    if (stage === 'frame') {
      readCaptureFrame.mockRejectedValueOnce(new Error('internal detail'))
    }

    if (stage === 'unsupported') {
      readCaptureFrame.mockResolvedValueOnce({ kind: 'unsupported' })
    }

    if (stage === 'worker') {
      moduleMocks.createPartyOcrWorker.mockRejectedValueOnce(new Error('internal detail'))
    }

    if (stage === 'ocr') {
      worker.recognize.mockRejectedValueOnce(new Error('internal detail'))
    }
    await shortcut()
    expect(hook.getCurrent().phase).toBe('failed')
    expect(hook.getCurrent().status).toBe(status)
    expect(report).toHaveBeenCalledWith(code)
    expect(endCalls()).toEqual(
      stage === 'begin' ? [] : [[{ action: 'end', captureId: CAPTURE_ID }]]
    )
    expect(hook.getCurrent().canStartCapture).toBe(true)
    if (stage === 'ocr') {
      expect(worker.terminate).toHaveBeenCalledOnce()
    }
    expect(beginCalls()).toHaveLength(1)
    await shortcut()
    expect(hook.getCurrent().phase).toBe('complete')
    expect(api.selectCaptureSource).toHaveBeenCalledExactlyOnceWith('game')
    await hook.unmount()
  }
)

it.each(['restart', 'stop', 'source', 'unmount'] as const)(
  '%s 뒤 이전 OCR의 늦은 결과는 검색과 화면을 바꾸지 않는다',
  async (action) => {
    const previous = captureResources().worker
    const next = captureResources().worker
    const pending = Promise.withResolvers<ReturnType<typeof ocrResult>>()
    previous.recognize
      .mockResolvedValueOnce(ocrResult('첫결과'))
      .mockReturnValueOnce(pending.promise)
    next.recognize.mockResolvedValue(ocrResult('새이름'))
    moduleMocks.createPartyOcrWorker.mockResolvedValueOnce(previous).mockResolvedValue(next)
    setSlots(0, 1, 2, 3)
    const hook = await renderPartyCaptureHook()
    await act(async () => hook.getCurrent().source.selectSource('game'))
    await shortcut()
    expect(hook.getCurrent().phase).toBe('recognizing')
    expect(api.notifyOcrCandidatesDetected).not.toHaveBeenCalled()
    const signal = moduleMocks.createPartyOcrWorker.mock.calls[0][0] as AbortSignal
    if (action === 'restart') {
      await shortcut()
    }

    if (action === 'stop') {
      await act(async () => hook.getCurrent().stopCapture())
    }

    if (action === 'source') {
      await act(async () => hook.getCurrent().source.selectSource('other'))
    }

    if (action === 'unmount') {
      await hook.unmount()
    }
    expect(signal.aborted).toBe(true)
    expect(search.controlCharacterSearch).toHaveBeenCalledWith({
      action: 'end',
      captureId: CAPTURE_ID
    })
    const state = hook.getCurrent()
    const notifications = api.notifyOcrCandidatesDetected.mock.calls.slice()
    await act(async () => pending.resolve(ocrResult('늦은이름')))
    expect(api.notifyOcrCandidatesDetected.mock.calls).toEqual(notifications)
    expect(hook.getCurrent().nicknames).toEqual(state.nicknames)
    expect(hook.getCurrent().status).toBe(state.status)
    expect(previous.terminate).toHaveBeenCalledOnce()
    if (action === 'restart') {
      expect(state.nicknames).toEqual(['새이름', '새이름', '새이름', '새이름'])
    } else {
      expect(state.nicknames).toEqual([null, null, null, null])
    }

    if (action === 'source') {
      expect(state.phase).toBe('selected')
      expect(readCaptureFrame).toHaveBeenCalledOnce()
    }

    if (action !== 'unmount') {
      await hook.unmount()
    }
  }
)

it.each(['frame', 'worker'] as const)(
  '%s 준비 중 Alt+R은 회차를 교체하고 늦은 준비 결과를 폐기한다',
  async (stage) => {
    const old = captureResources()
    const next = captureResources()
    const pendingFrame = Promise.withResolvers<WindowFrameResult>()
    const pendingWorker = Promise.withResolvers<typeof old.worker>()
    setSlots(0)
    if (stage === 'frame') {
      readCaptureFrame.mockReturnValueOnce(pendingFrame.promise)
    } else {
      moduleMocks.createPartyOcrWorker.mockReturnValueOnce(pendingWorker.promise)
    }
    moduleMocks.createPartyOcrWorker.mockResolvedValue(next.worker)
    const hook = await renderPartyCaptureHook()
    await act(async () => hook.getCurrent().source.selectSource('game'))
    await shortcut()
    expect(hook.getCurrent().phase).toBe('recognizing')
    await shortcut()
    await act(async () => {
      pendingFrame.resolve(old.frame)
      pendingWorker.resolve(old.worker)
    })
    expect(hook.getCurrent().phase).toBe('complete')
    expect(api.notifyOcrCandidatesDetected).toHaveBeenCalledOnce()
    expect(old.worker.recognize).not.toHaveBeenCalled()
    expect(old.worker.terminate).toHaveBeenCalledTimes(stage === 'worker' ? 1 : 0)
    expect(next.worker.terminate).toHaveBeenCalledOnce()
    expect(
      search.controlCharacterSearch.mock.calls
        .map(([command]) => command.action)
        .filter((action) => action === 'begin' || action === 'end')
    ).toEqual(['begin', 'end', 'begin'])
    await hook.unmount()
  }
)

it('검색 시작 대기 중 Alt+R은 무시하고 begin 완료 뒤 같은 회차를 이어간다', async () => {
  setSlots(0)
  const hook = await renderPartyCaptureHook()
  await act(async () => hook.getCurrent().source.selectSource('game'))
  const begin =
    Promise.withResolvers<Awaited<ReturnType<typeof window.search.controlCharacterSearch>>>()
  search.controlCharacterSearch.mockImplementationOnce((command: SearchControl) => {
    expect(command.action).toBe('begin')
    currentSearch = searchSnapshot({ revision: currentSearch.revision + 1 })

    return begin.promise
  })
  await shortcut()
  const round = hook.getCurrent().round
  expect(readCaptureFrame).not.toHaveBeenCalled()
  await shortcut()
  expect(beginCalls()).toHaveLength(1)
  expect(readCaptureFrame).not.toHaveBeenCalled()
  expect(hook.getCurrent().round).toBe(round)
  expect(hook.getCurrent().phase).toBe('recognizing')
  expect(hook.getCurrent().canStartCapture).toBe(false)
  await act(async () => begin.resolve({ ok: true, snapshot: currentSearch }))
  expect(readCaptureFrame).toHaveBeenCalledExactlyOnceWith(CAPTURE_ID)
  expect(hook.getCurrent().round).toBe(round)
  expect(hook.getCurrent().phase).toBe('complete')
  expect(search.controlCharacterSearch).not.toHaveBeenCalledWith({
    action: 'end',
    captureId: CAPTURE_ID
  })
  await hook.unmount()
})

it('완료 뒤 창 변경은 검색과 이름을 지우고 새 창만 등록한다', async () => {
  setSlots(0)
  const hook = await renderPartyCaptureHook()
  await act(async () => hook.getCurrent().source.selectSource('game'))
  await shortcut()
  await act(async () => hook.getCurrent().source.selectSource('other'))
  expect(hook.getCurrent().phase).toBe('selected')
  expect(hook.getCurrent().nicknames).toEqual([null, null, null, null])
  expect(endCalls()).toEqual([[{ action: 'end', captureId: CAPTURE_ID }]])
  expect(readCaptureFrame).toHaveBeenCalledOnce()
  expect(api.selectCaptureSource).toHaveBeenLastCalledWith('other')
  await hook.unmount()
})

it('StrictMode 재마운트 뒤 선택, 회차와 종료 정리를 수행한다', async () => {
  setSlots(0)
  const hook = await renderPartyCaptureHook(true)
  await act(async () => hook.getCurrent().source.selectSource('game'))
  await act(async () => hook.getCurrent().startRound())
  expect(hook.getCurrent().phase).toBe('complete')
  expect(readCaptureFrame).toHaveBeenCalledOnce()
  await hook.unmount()
  expect(api.selectCaptureSource).toHaveBeenLastCalledWith('')
})

it.each(['resolve', 'reject'] as const)(
  'unmount 뒤 늦은 worker 준비 %s는 결과나 진단을 남기지 않는다',
  async (outcome) => {
    const report = vi.spyOn(diagnostics, 'reportRendererDiagnostic')
    const { worker } = captureResources()
    const pending = Promise.withResolvers<typeof worker>()
    moduleMocks.createPartyOcrWorker.mockReturnValueOnce(pending.promise)
    setSlots(0)
    const hook = await renderPartyCaptureHook()
    await act(async () => hook.getCurrent().source.selectSource('game'))
    await shortcut()
    expect(moduleMocks.createPartyOcrWorker).toHaveBeenCalledOnce()
    await hook.unmount()
    await act(async () => {
      if (outcome === 'resolve') {
        pending.resolve(worker)
      } else {
        pending.reject(new Error('late worker failure'))
      }
    })
    expect(worker.terminate).toHaveBeenCalledTimes(outcome === 'resolve' ? 1 : 0)
    expect(worker.recognize).not.toHaveBeenCalled()
    expect(api.notifyOcrCandidatesDetected).not.toHaveBeenCalled()
    expect(report).not.toHaveBeenCalled()
  }
)

it('창 목록이 늦게 도착해도 중지 뒤에는 자동 등록하지 않는다', async () => {
  const pending = Promise.withResolvers<{ id: string; name: string }[]>()
  api.listCaptureSources.mockReturnValueOnce(pending.promise)
  const hook = await renderPartyCaptureHook()
  await act(async () => hook.getCurrent().stopCapture())
  await act(async () => pending.resolve([{ id: 'dnf', name: '던전앤파이터' }]))
  await shortcut()
  expect(api.selectCaptureSource).not.toHaveBeenCalled()
  expect(beginCalls()).toHaveLength(0)
  expect(hook.getCurrent().canStartCapture).toBe(false)
  await hook.unmount()
})

it('회차가 끝난 뒤 창 목록 조회 실패는 결과와 검색 수명을 바꾸지 않는다', async () => {
  setSlots(0)
  const hook = await renderPartyCaptureHook()
  await act(async () => hook.getCurrent().source.selectSource('game'))
  await shortcut()
  const state = hook.getCurrent()
  api.listCaptureSources.mockRejectedValueOnce(new Error('list failure'))
  await act(async () => hook.getCurrent().source.refreshSources())
  expect(hook.getCurrent().source.sourcesFailed).toBe(true)
  expect(hook.getCurrent().phase).toBe('complete')
  expect(hook.getCurrent().status).toBe(state.status)
  expect(hook.getCurrent().nicknames).toEqual(state.nicknames)
  expect(readCaptureFrame).toHaveBeenCalledOnce()
  await act(async () => hook.getCurrent().stopCapture())
  expect(endCalls()).toEqual([[{ action: 'end', captureId: CAPTURE_ID }]])
  await hook.unmount()
})

it.each(['failed', 'rejected'] as const)(
  '두 번째 슬롯 OCR 실패 시 뒤 슬롯이 %s여도 검색을 통지하지 않고 실패로 끝낸다',
  async (laterResult) => {
    const report = vi.spyOn(diagnostics, 'reportRendererDiagnostic')
    const { worker } = captureResources()
    worker.recognize
      .mockRejectedValue(new Error('Worker unavailable'))
      .mockResolvedValueOnce(ocrResult(' 원문 '))
      .mockRejectedValueOnce(new Error('Second slot failed'))
    if (laterResult === 'rejected') {
      worker.recognize.mockResolvedValueOnce(ocrResult('  '))
    }
    moduleMocks.createPartyOcrWorker.mockResolvedValue(worker)
    setSlots(0, 1, 2, 3)
    const hook = await renderPartyCaptureHook()
    await act(async () => hook.getCurrent().source.selectSource('game'))
    await shortcut()

    expect(worker.recognize).toHaveBeenCalledTimes(4)
    expect(api.notifyOcrCandidatesDetected).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledExactlyOnceWith('OCR_FAILED')
    expect(hook.getCurrent().phase).toBe('failed')
    expect(hook.getCurrent().status).toBe(
      '글자 인식에 실패했습니다. Alt+R을 누르거나 캐릭터 직접 검색을 사용해 주세요.'
    )
    expect(hook.getCurrent().nicknames).toEqual([null, null, null, null])
    expect(endCalls()).toEqual([[{ action: 'end', captureId: CAPTURE_ID }]])
    expect(worker.terminate).toHaveBeenCalledOnce()
    await hook.unmount()
  }
)

it('검색 event를 구독한 뒤 read하고 unmount에서 그 구독을 해제한다', async () => {
  const unsubscribe = vi.fn()
  search.onCharacterSearchChanged.mockReturnValue(unsubscribe)
  const hook = await renderPartyCaptureHook()
  expect(search.onCharacterSearchChanged).toHaveBeenCalledOnce()
  expect(search.controlCharacterSearch.mock.calls[0]).toEqual([{ action: 'read' }])
  expect(search.onCharacterSearchChanged.mock.invocationCallOrder[0]).toBeLessThan(
    search.controlCharacterSearch.mock.invocationCallOrder[0]
  )
  expect(unsubscribe).not.toHaveBeenCalled()
  await hook.unmount()
  expect(unsubscribe).toHaveBeenCalledOnce()
})

it.each(['pending', 'failed'] as const)(
  '검색 상태 동기화가 %s이면 창 선택 뒤 Alt+R에도 begin을 보내지 않는다',
  async (readState) => {
    const read = Promise.withResolvers<SearchCommandResult>()
    search.controlCharacterSearch.mockReturnValueOnce(read.promise)
    const hook = await renderPartyCaptureHook()
    if (readState === 'failed') {
      await act(async () => read.reject(new Error('Synthetic initial read failure')))
    }
    await act(async () => hook.getCurrent().source.selectSource('game'))
    await shortcut()
    expect(hook.getCurrent().phase).toBe('failed')
    expect(search.controlCharacterSearch).toHaveBeenCalledExactlyOnceWith({ action: 'read' })
    expect(readCaptureFrame).not.toHaveBeenCalled()
    expect(moduleMocks.createPartyOcrWorker).not.toHaveBeenCalled()
    await hook.unmount()
  }
)

it.each(['stop', 'source', 'unmount'] as const)(
  '%s 뒤 늦은 begin 성공은 그 capture ID만 end하고 프레임 읽기를 시작하지 않는다',
  async (action) => {
    const begin = Promise.withResolvers<SearchCommandResult>()
    const hook = await renderPartyCaptureHook()
    await act(async () => hook.getCurrent().source.selectSource('game'))
    search.controlCharacterSearch.mockReturnValueOnce(begin.promise)
    await shortcut()
    if (action === 'stop') {
      await act(async () => hook.getCurrent().stopCapture())
    }

    if (action === 'source') {
      await act(async () => hook.getCurrent().source.selectSource('other'))
    }

    if (action === 'unmount') {
      await hook.unmount()
    }
    await act(async () => begin.resolve({ ok: true, snapshot: searchSnapshot() }))
    expect(endCalls()).toEqual([[{ action: 'end', captureId: CAPTURE_ID }]])
    expect(readCaptureFrame).not.toHaveBeenCalled()
    expect(moduleMocks.createPartyOcrWorker).not.toHaveBeenCalled()
    if (action !== 'unmount') {
      await hook.unmount()
    }
  }
)

it.each(['ended', 'other capture'] as const)(
  'begin 응답보다 새로운 %s snapshot이 먼저 오면 늦은 ID로 프레임 읽기를 시작하지 않는다',
  async (transition) => {
    const begin = Promise.withResolvers<SearchCommandResult>()
    const hook = await renderPartyCaptureHook()
    await act(async () => hook.getCurrent().source.selectSource('game'))
    search.controlCharacterSearch.mockReturnValueOnce(begin.promise)
    await shortcut()
    const captureId = transition === 'ended' ? null : NEXT_CAPTURE_ID
    await emit(searchSnapshot({ captureId, revision: 2 }))
    await act(async () =>
      begin.resolve({ ok: true, snapshot: searchSnapshot({ captureId: CAPTURE_ID, revision: 1 }) })
    )
    expect(readCaptureFrame).not.toHaveBeenCalled()
    expect(moduleMocks.createPartyOcrWorker).not.toHaveBeenCalled()
    expect(endCalls()).toEqual([[{ action: 'end', captureId: CAPTURE_ID }]])
    await hook.unmount()
  }
)

it.each(['older end', 'newer same capture'] as const)(
  '%s snapshot은 유효한 begin의 프레임 읽기를 취소하지 않는다',
  async (transition) => {
    const begin = Promise.withResolvers<SearchCommandResult>()
    const hook = await renderPartyCaptureHook()
    await act(async () => hook.getCurrent().source.selectSource('game'))
    search.controlCharacterSearch.mockReturnValueOnce(begin.promise)
    await shortcut()
    const isOlderEnd = transition === 'older end'
    await emit(
      searchSnapshot({ captureId: isOlderEnd ? null : CAPTURE_ID, revision: isOlderEnd ? 1 : 3 })
    )
    await act(async () =>
      begin.resolve({ ok: true, snapshot: searchSnapshot({ captureId: CAPTURE_ID, revision: 2 }) })
    )
    expect(readCaptureFrame).toHaveBeenCalledExactlyOnceWith(CAPTURE_ID)
    expect(moduleMocks.createPartyOcrWorker).toHaveBeenCalledOnce()
    expect(endCalls()).toEqual([])
    await act(async () => hook.getCurrent().stopCapture())
    expect(endCalls()).toEqual([[{ action: 'end', captureId: CAPTURE_ID }]])
    await hook.unmount()
  }
)

it('중지한 회차의 늦은 프레임 읽기 실패는 새 회차의 검색을 끝내지 않는다', async () => {
  setSlots(0)
  const oldFrame = Promise.withResolvers<WindowFrameResult>()
  readCaptureFrame.mockReturnValueOnce(oldFrame.promise)
  const hook = await renderPartyCaptureHook()
  await act(async () => hook.getCurrent().source.selectSource('game'))
  await shortcut()
  await act(async () => hook.getCurrent().stopCapture())
  await act(async () => hook.getCurrent().source.selectSource('game'))
  beginNextCapture(NEXT_CAPTURE_ID)
  await shortcut()
  expect(readCaptureFrame).toHaveBeenLastCalledWith(NEXT_CAPTURE_ID)
  await act(async () => oldFrame.reject(new Error('Synthetic old frame failure')))
  expect(endCalls()).toEqual([[{ action: 'end', captureId: CAPTURE_ID }]])
  expect(hook.getCurrent().phase).toBe('complete')
  await act(async () => hook.getCurrent().stopCapture())
  expect(endCalls()).toEqual([
    [{ action: 'end', captureId: CAPTURE_ID }],
    [{ action: 'end', captureId: NEXT_CAPTURE_ID }]
  ])
  await hook.unmount()
})

it('취소한 회차의 begin 응답이 유실된 뒤 read가 새 capture를 찾아도 그 ID를 end하지 않는다', async () => {
  const previous = Promise.withResolvers<SearchCommandResult>()
  const hook = await renderPartyCaptureHook()
  await act(async () => hook.getCurrent().source.selectSource('game'))
  search.controlCharacterSearch.mockReturnValueOnce(previous.promise)
  await shortcut()
  await act(async () => hook.getCurrent().stopCapture())
  await act(async () => hook.getCurrent().source.selectSource('game'))
  beginNextCapture(NEXT_CAPTURE_ID)
  await shortcut()
  await emit(currentSearch)
  await act(async () => previous.reject(new Error('Synthetic old begin response loss')))
  expect(search.controlCharacterSearch).toHaveBeenLastCalledWith({ action: 'read' })
  expect(endCalls()).toEqual([])
  expect(readCaptureFrame).toHaveBeenCalledExactlyOnceWith(NEXT_CAPTURE_ID)
  await act(async () => hook.getCurrent().stopCapture())
  expect(endCalls()).toEqual([[{ action: 'end', captureId: NEXT_CAPTURE_ID }]])
  await hook.unmount()
})

it('OCR 통지 응답이 유실되면 read로만 확인하고 같은 통지를 다시 보내지 않는다', async () => {
  setSlots(0)
  const { worker } = captureResources()
  const recognition = Promise.withResolvers<ReturnType<typeof ocrResult>>()
  worker.recognize.mockReturnValueOnce(recognition.promise)
  moduleMocks.createPartyOcrWorker.mockResolvedValue(worker)
  const hook = await renderPartyCaptureHook()
  await act(async () => hook.getCurrent().source.selectSource('game'))
  await shortcut()
  const completed = searchSnapshot({
    revision: 10,
    slots: [
      searchSlot({ nickname: 'Alice', state: 'success', rows: [searchRow] }),
      ...searchSnapshot().slots.slice(1)
    ]
  })
  api.notifyOcrCandidatesDetected.mockRejectedValueOnce(new Error('Synthetic IPC loss'))
  search.controlCharacterSearch.mockResolvedValueOnce({ ok: true, snapshot: completed })
  const before = search.controlCharacterSearch.mock.calls.length
  await act(async () => recognition.resolve(ocrResult('Alice')))
  expect(search.controlCharacterSearch.mock.calls.slice(before)).toEqual([[{ action: 'read' }]])
  expect(api.notifyOcrCandidatesDetected).toHaveBeenCalledOnce()
  expect(hook.getCurrent().search.slots[0]).toEqual(completed.slots[0])
  await hook.unmount()
})

it.each(invalidSearchSnapshots)(
  '%s event는 검색 상태에 반영하지 않는다',
  async (_name, invalid) => {
    setSlots(0)
    const hook = await renderPartyCaptureHook()
    await act(async () => hook.getCurrent().source.selectSource('game'))
    await shortcut()
    const valid = searchSnapshot({
      revision: 10,
      slots: [
        searchSlot({ nickname: 'Alice', state: 'success', rows: [searchRow] }),
        ...searchSnapshot().slots.slice(1)
      ]
    })
    await emit(valid)
    expect(hook.getCurrent().search.slots).toEqual(valid.slots)
    const malformed = invalid() as SearchSnapshot
    const hasUsableRevision = Number.isSafeInteger(malformed.revision) && malformed.revision >= 0
    await emit({ ...malformed, revision: hasUsableRevision ? 99 : malformed.revision })
    expect(hook.getCurrent().search.slots).toEqual(valid.slots)
    await hook.unmount()
  }
)

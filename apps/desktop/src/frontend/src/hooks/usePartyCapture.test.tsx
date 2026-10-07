// @vitest-environment jsdom

import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CAPTURE_ID, searchSnapshot } from '../../../preload/api/search-test-fixture'
import type { SearchControl } from '../../../preload/common/types/search'
import { usePartyCapture } from './usePartyCapture'

const moduleMocks = vi.hoisted(() => {
  const capturePartyNicknameCrops = vi.fn()
  const capturePartyRecognitionInputs = vi.fn()
  const createPartyOcrWorker = vi.fn()
  const runSerialLoop = vi.fn()

  return {
    capturePartyNicknameCrops,
    capturePartyRecognitionInputs,
    createPartyOcrWorker,
    runSerialLoop
  }
})

vi.mock('../lib/ocr', async (importOriginal) => {
  const ocr = { ...(await importOriginal<typeof import('../lib/ocr')>()) }
  ocr.createPartyOcrWorker = moduleMocks.createPartyOcrWorker

  return ocr
})

vi.mock('../lib/party', async (importOriginal) => {
  const party = { ...(await importOriginal<typeof import('../lib/party')>()) }
  party.capturePartyNicknameCrops = moduleMocks.capturePartyNicknameCrops
  party.capturePartyRecognitionInputs = moduleMocks.capturePartyRecognitionInputs

  return party
})

vi.mock('../lib/recognition', async (importOriginal) => {
  const recognition = { ...(await importOriginal<typeof import('../lib/recognition')>()) }
  recognition.runSerialLoop = moduleMocks.runSerialLoop

  return recognition
})

type HookValue = ReturnType<typeof usePartyCapture>

type LoopOptions = {
  signal: AbortSignal
  getIntervalMs: () => number
  runCycle: () => Promise<void>
}

const api = {
  listCaptureSources: vi.fn(),
  notifyStableNicknameDetected: vi.fn(),
  notifyOcrCandidatesDetected: vi.fn(),
  selectCaptureSource: vi.fn()
}

const search = { controlCharacterSearch: vi.fn(), onCharacterSearchChanged: vi.fn() }
let currentSearch = searchSnapshot({ captureId: null, revision: 0 })
const getDisplayMedia = vi.fn()

function HookHarness({
  onRender,
  identifyCharacters
}: {
  onRender: (value: HookValue) => void
  identifyCharacters: boolean
}): null {
  onRender(usePartyCapture({ identifyCharacters }))

  return null
}

async function renderPartyCaptureHook(
  strict = false,
  identifyCharacters = false
): Promise<{
  getCurrent: () => HookValue
  unmount: () => Promise<void>
}> {
  const container = document.createElement('div')
  const root: Root = createRoot(container)
  let current: HookValue | undefined

  await act(async () => {
    const harness = (
      <HookHarness
        onRender={(value) => (current = value)}
        identifyCharacters={identifyCharacters}
      />
    )
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
  track: EventTarget & { stop: ReturnType<typeof vi.fn> }
  stream: MediaStream
  worker: { recognize: ReturnType<typeof vi.fn>; terminate: ReturnType<typeof vi.fn> }
} {
  const track = Object.assign(new EventTarget(), { stop: vi.fn() })
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track]
  } as unknown as MediaStream
  const worker = {
    recognize: vi.fn().mockResolvedValue({ data: { text: 'Alice' } }),
    terminate: vi.fn().mockResolvedValue(undefined)
  }

  return { track, stream, worker }
}

function loadVideoMetadata(
  video: HTMLMediaElement,
  dimensions: { width?: number; height?: number } = {},
  access?: string[]
): void {
  Object.defineProperty(video, 'videoWidth', {
    configurable: true,
    get: () => {
      access?.push('videoWidth')
      const width = dimensions.width
      if (width != null) {
        return width
      }

      return 1920
    }
  })
  Object.defineProperty(video, 'videoHeight', {
    configurable: true,
    get: () => {
      access?.push('videoHeight')
      const height = dimensions.height
      if (height != null) {
        return height
      }

      return 1080
    }
  })
  video.dispatchEvent(new Event('loadedmetadata'))
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true
  })
  Object.defineProperty(window, 'api', { configurable: true, value: api })
  Object.defineProperty(window, 'search', { configurable: true, value: search })
  currentSearch = searchSnapshot({ captureId: null, revision: 0 })
  search.onCharacterSearchChanged.mockReturnValue(() => {})
  search.controlCharacterSearch.mockImplementation(async (control: SearchControl) => {
    const isBegin = control.action === 'begin'
    const isEnd = control.action === 'end'
    const shouldChangeCapture = isBegin || isEnd
    if (shouldChangeCapture) {
      currentSearch = searchSnapshot({
        captureId: isBegin ? CAPTURE_ID : null,
        revision: currentSearch.revision + 1
      })
    }

    return { ok: true, snapshot: currentSearch }
  })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getDisplayMedia }
  })

  api.listCaptureSources.mockResolvedValue([])
  api.notifyStableNicknameDetected.mockImplementation(async () => ({
    ok: true,
    snapshot: currentSearch
  }))
  api.notifyOcrCandidatesDetected.mockImplementation(async () => ({
    ok: true,
    snapshot: currentSearch
  }))
  api.selectCaptureSource.mockResolvedValue(null)
  moduleMocks.capturePartyNicknameCrops.mockReturnValue([null, null, null, null])
  moduleMocks.capturePartyRecognitionInputs.mockReturnValue([null, null, null, null])
  moduleMocks.runSerialLoop.mockImplementation(() => new Promise<void>(() => undefined))

  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async function (
    this: HTMLMediaElement
  ) {
    loadVideoMetadata(this)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('usePartyCapture', () => {
  it('식별 모드가 같은 프레임의 후보를 OCR IPC로 전달하고 중지 뒤에는 다시 안정화한다', async () => {
    const { stream, worker } = captureResources()
    const nickname = document.createElement('canvas')
    let loopOptions: LoopOptions | undefined
    getDisplayMedia.mockResolvedValue(stream)
    moduleMocks.createPartyOcrWorker.mockResolvedValue(worker)
    worker.recognize.mockResolvedValue({
      data: {
        text: '기사*',
        confidence: 20,
        candidates: [
          { nickname: '기사*', rank: 1, modelScore: 20 },
          { nickname: '기사☆', rank: 2, modelScore: 10 }
        ]
      }
    })
    moduleMocks.capturePartyRecognitionInputs.mockReturnValue([
      { slot: 0, nickname, portrait: null },
      null,
      null,
      null
    ])
    moduleMocks.runSerialLoop.mockImplementation((options: LoopOptions) => {
      loopOptions = options

      return new Promise<void>(() => undefined)
    })
    const hook = await renderPartyCaptureHook(false, true)
    await act(async () => hook.getCurrent().selectAndStartCapture('game'))
    await act(async () => loopOptions?.runCycle())
    expect(api.notifyOcrCandidatesDetected).not.toHaveBeenCalled()
    await act(async () => loopOptions?.runCycle())

    expect(api.notifyOcrCandidatesDetected).toHaveBeenCalledExactlyOnceWith({
      captureId: CAPTURE_ID,
      slot: 0,
      observationRevision: 1,
      nickname: '기사*',
      candidateNicknames: ['기사*', '기사☆'],
      portrait: null
    })
    expect(api.notifyStableNicknameDetected).not.toHaveBeenCalled()
    expect(moduleMocks.capturePartyNicknameCrops).not.toHaveBeenCalled()
    expect(hook.getCurrent().stableNicknames[0]).toBe('기사*')

    await act(async () => hook.getCurrent().stopCapture())
    expect(hook.getCurrent().stableNicknames[0]).toBeNull()
    await act(async () => hook.getCurrent().startCapture())
    await act(async () => loopOptions?.runCycle())
    expect(api.notifyOcrCandidatesDetected).toHaveBeenCalledTimes(1)
    await act(async () => loopOptions?.runCycle())
    expect(api.notifyOcrCandidatesDetected).toHaveBeenCalledTimes(2)
    await hook.unmount()
  })

  it('수동 검색에서 OCR로 복귀할 때 최신 후보 순서와 얼굴을 함께 복구한다', async () => {
    const { stream, worker } = captureResources()
    getDisplayMedia.mockResolvedValue(stream)
    moduleMocks.createPartyOcrWorker.mockResolvedValue(worker)
    const hook = await renderPartyCaptureHook(false, true)
    await act(async () => hook.getCurrent().selectAndStartCapture('game'))
    await act(async () => hook.getCurrent().search.editSlot(0))
    const latest = {
      slot: 0,
      nickname: '새별*',
      candidateNicknames: ['새별*', '새별☆'],
      portrait: {
        image: { width: 1, height: 1, rgba: new Uint8Array([1, 2, 3, 255]) },
        rasterScale: 2
      }
    }
    await act(async () => hook.getCurrent().search.observeOcr(latest))
    expect(api.notifyOcrCandidatesDetected).not.toHaveBeenCalled()
    await act(async () => hook.getCurrent().search.submitSlot(0, '직접검색'))
    expect(api.notifyStableNicknameDetected).toHaveBeenCalledTimes(1)

    await act(async () => hook.getCurrent().search.resumeOcr(0))

    expect(api.notifyOcrCandidatesDetected).toHaveBeenCalledExactlyOnceWith({
      ...latest,
      captureId: CAPTURE_ID,
      observationRevision: 5
    })
    expect(hook.getCurrent().search.manualSlots[0]).toBe(false)
    await hook.unmount()
  })

  it('새로고침으로 나중에 열린 창을 표시하며 기존 선택을 유지한다', async () => {
    const initialSource = { id: 'initial-window', name: 'Initial window' }
    const gameSource = { id: 'later-window', name: 'Later game window' }
    api.listCaptureSources.mockResolvedValueOnce([initialSource])
    const hook = await renderPartyCaptureHook()
    await act(async () => hook.getCurrent().selectSource(initialSource.id))
    api.selectCaptureSource.mockClear()
    api.listCaptureSources.mockResolvedValueOnce([initialSource, gameSource])

    await act(async () => hook.getCurrent().refreshSources())

    expect(hook.getCurrent().sources).toEqual([initialSource, gameSource])
    expect(hook.getCurrent().selectedSourceId).toBe(initialSource.id)
    expect(hook.getCurrent().sourceRegistered).toBe(true)
    expect(api.selectCaptureSource).not.toHaveBeenCalled()
    await hook.unmount()
  })

  it('새로고침 뒤에 도착한 이전 목록은 최신 창 목록을 덮어쓰지 않는다', async () => {
    const initialList = Promise.withResolvers<{ id: string; name: string }[]>()
    api.listCaptureSources.mockReturnValueOnce(initialList.promise)
    const hook = await renderPartyCaptureHook()
    const gameSource = { id: 'later-window', name: 'Later game window' }
    api.listCaptureSources.mockResolvedValueOnce([gameSource])
    await act(async () => hook.getCurrent().refreshSources())

    initialList.resolve([{ id: 'old-window', name: 'Old window' }])
    await flushPromises()

    expect(hook.getCurrent().sources).toEqual([gameSource])
    await hook.unmount()
  })

  it('창 목록 오류는 캡처 상태와 분리하고 창 선택 실패는 복구 안내를 표시한다', async () => {
    api.listCaptureSources.mockRejectedValueOnce(new Error('synthetic internal detail'))
    const hook = await renderPartyCaptureHook()
    expect(hook.getCurrent().sourcesFailed).toBe(true)
    expect(hook.getCurrent().status).toBe('캡처할 게임 창을 선택해 주세요.')
    api.listCaptureSources.mockResolvedValueOnce([{ id: 'game', name: '던전앤파이터' }])
    await act(async () => hook.getCurrent().refreshSources())
    expect(hook.getCurrent().sourcesFailed).toBe(false)
    expect(hook.getCurrent().status).toBe('캡처할 게임 창을 선택해 주세요.')

    api.selectCaptureSource.mockRejectedValueOnce(new Error('synthetic internal detail'))
    await act(async () => hook.getCurrent().selectSource('synthetic-window'))
    expect(hook.getCurrent().status).toBe('게임 창을 선택하지 못했습니다. 창을 다시 선택해 주세요.')
    expect(hook.getCurrent().sourceRegistered).toBe(false)
    await hook.unmount()
  })

  it.each(['media', 'worker'] as const)(
    '%s 준비 실패를 구분하고 자원을 정리한다',
    async (stage) => {
      const { stream, track, worker } = captureResources()
      getDisplayMedia.mockResolvedValue(stream)
      moduleMocks.createPartyOcrWorker.mockResolvedValue(worker)
      vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(async function (
        this: HTMLMediaElement
      ) {
        loadVideoMetadata(this)
      })
      const failure = new Error('synthetic internal detail')
      if (stage === 'media') {
        getDisplayMedia.mockRejectedValueOnce(failure)
      } else {
        moduleMocks.createPartyOcrWorker.mockRejectedValueOnce(failure)
      }
      const hook = await renderPartyCaptureHook()
      await act(async () => hook.getCurrent().selectSource('synthetic-window'))
      await act(async () => hook.getCurrent().startCapture())
      expect(hook.getCurrent().status).toBe(
        stage === 'media'
          ? '캡처를 시작하지 못했습니다. 게임이 최소화되지 않았는지 확인하고 창을 다시 선택해 주세요.'
          : '글자 인식을 준비하지 못했습니다. 캡처를 다시 시작해 주세요.'
      )
      expect(hook.getCurrent().starting).toBe(false)
      expect(hook.getCurrent().search.captureActive).toBe(false)
      expect(track.stop).toHaveBeenCalledTimes(stage === 'worker' ? 1 : 0)
      await hook.unmount()
    }
  )

  it('manual slot edits suppress OCR submissions until resume, and Stop resets the override', async () => {
    const { stream, worker, track } = captureResources()
    getDisplayMedia.mockResolvedValue(stream)
    moduleMocks.createPartyOcrWorker.mockResolvedValue(worker)
    const hook = await renderPartyCaptureHook()
    act(() => hook.getCurrent().selectSource('game'))
    await flushPromises()
    await act(async () => hook.getCurrent().startCapture())

    await act(async () => hook.getCurrent().search.observe({ slot: 0, nickname: 'SyntheticA' }))
    await act(async () => hook.getCurrent().search.editSlot(0))
    expect(hook.getCurrent().search.manualSlots[0]).toBe(true)
    api.notifyStableNicknameDetected.mockClear()
    await act(async () => hook.getCurrent().search.observe({ slot: 0, nickname: 'SyntheticB' }))
    expect(api.notifyStableNicknameDetected).not.toHaveBeenCalled()
    await act(async () => hook.getCurrent().search.submitSlot(0, 'SyntheticC'))
    expect(api.notifyStableNicknameDetected).toHaveBeenLastCalledWith(
      expect.objectContaining({ nickname: 'SyntheticC', slot: 0 })
    )
    await act(async () => hook.getCurrent().search.observe({ slot: 0, nickname: null }))
    expect(api.notifyStableNicknameDetected).toHaveBeenCalledTimes(1)
    await act(async () => hook.getCurrent().search.observe({ slot: 1, nickname: 'OtherSlot' }))
    expect(api.notifyStableNicknameDetected).toHaveBeenLastCalledWith(
      expect.objectContaining({ nickname: 'OtherSlot', slot: 1 })
    )
    await act(async () => hook.getCurrent().search.observe({ slot: 0, nickname: 'SyntheticD' }))
    await act(async () => hook.getCurrent().search.resumeOcr(0))
    expect(api.notifyStableNicknameDetected).toHaveBeenLastCalledWith(
      expect.objectContaining({ nickname: 'SyntheticD', slot: 0 })
    )
    expect(hook.getCurrent().search.manualSlots[0]).toBe(false)
    await act(async () => hook.getCurrent().search.editSlot(0))
    await act(async () => hook.getCurrent().stopCapture())
    expect(hook.getCurrent().search.manualSlots).toEqual([false, false, false, false])
    expect(hook.getCurrent().search.captureActive).toBe(false)
    expect(track.stop).toHaveBeenCalledOnce()
    expect(worker.terminate).toHaveBeenCalledOnce()
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

    expect(hook.getCurrent().sources).toEqual([
      { id: 'old', name: 'Old window' },
      { id: 'new', name: 'New window' }
    ])

    act(() => hook.getCurrent().selectSource('old'))
    act(() => hook.getCurrent().selectSource('new'))
    await act(async () => hook.getCurrent().startCapture())

    expect(hook.getCurrent().status).toBe(
      '게임 창 선택을 확인하고 있습니다. 잠시 후 캡처를 시작해 주세요.'
    )

    oldSelection.resolve(null)
    await flushPromises()
    expect(hook.getCurrent().sourceRegistered).toBe(false)

    newSelection.resolve(null)
    await flushPromises()
    expect(hook.getCurrent().selectedSourceId).toBe('new')
    expect(hook.getCurrent().sourceRegistered).toBe(true)

    await hook.unmount()
  })

  it('recognizes stable nicknames and releases capture resources on stop', async () => {
    const { track, stream, worker } = captureResources()
    const nicknameCrop = document.createElement('canvas')
    let loopOptions: LoopOptions | undefined

    getDisplayMedia.mockResolvedValue(stream)
    moduleMocks.createPartyOcrWorker.mockResolvedValue(worker)
    moduleMocks.capturePartyNicknameCrops.mockReturnValue([nicknameCrop, null, null, null])
    moduleMocks.runSerialLoop.mockImplementation((options: LoopOptions) => {
      loopOptions = options

      return new Promise<void>(() => undefined)
    })

    const hook = await renderPartyCaptureHook()
    act(() => hook.getCurrent().selectSource('game'))
    await flushPromises()

    await act(async () => hook.getCurrent().startCapture())

    expect(getDisplayMedia).toHaveBeenCalledWith({
      audio: false,
      video: {
        frameRate: { ideal: 1, max: 1 }
      }
    })
    expect(hook.getCurrent().status).toBe('캡처 중, 1920×1080')
    expect(worker.recognize).not.toHaveBeenCalled()
    expect(loopOptions?.getIntervalMs()).toBe(3000)

    await act(async () => loopOptions?.runCycle())
    await act(async () => loopOptions?.runCycle())

    expect(worker.recognize).toHaveBeenCalledTimes(2)
    expect(worker.recognize).toHaveBeenCalledWith(nicknameCrop)
    expect(hook.getCurrent().stableNicknames[0]).toBe('Alice')
    expect(api.notifyStableNicknameDetected).toHaveBeenCalledTimes(1)
    expect(api.notifyStableNicknameDetected).toHaveBeenCalledWith({
      captureId: CAPTURE_ID,
      observationRevision: 1,
      nickname: 'Alice',
      slot: 0
    })

    act(() => hook.getCurrent().stopCapture())

    expect(track.stop).toHaveBeenCalledOnce()
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(hook.getCurrent().stableNicknames).toEqual([null, null, null, null])
    expect(hook.getCurrent().status).toBe('캡처를 중지했습니다.')
    expect(loopOptions?.signal.aborted).toBe(true)

    await hook.unmount()
    expect(track.stop).toHaveBeenCalledOnce()
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('clears a stable nickname when OCR returns an empty nickname', async () => {
    const { stream, worker } = captureResources()
    const nicknameCrop = document.createElement('canvas')
    let loopOptions: LoopOptions | undefined

    getDisplayMedia.mockResolvedValue(stream)
    moduleMocks.createPartyOcrWorker.mockResolvedValue(worker)
    moduleMocks.capturePartyNicknameCrops.mockReturnValue([nicknameCrop, null, null, null])
    worker.recognize
      .mockResolvedValueOnce({ data: { text: 'Alice' } })
      .mockResolvedValueOnce({ data: { text: 'Alice' } })
      .mockResolvedValueOnce({ data: { text: '' } })
    moduleMocks.runSerialLoop.mockImplementation((options: LoopOptions) => {
      loopOptions = options

      return new Promise<void>(() => undefined)
    })

    const hook = await renderPartyCaptureHook()
    act(() => hook.getCurrent().selectSource('game'))
    await flushPromises()
    await act(async () => hook.getCurrent().startCapture())

    await act(async () => loopOptions?.runCycle())
    await act(async () => loopOptions?.runCycle())
    expect(hook.getCurrent().stableNicknames[0]).toBe('Alice')

    await act(async () => loopOptions?.runCycle())

    expect(hook.getCurrent().stableNicknames[0]).toBeNull()
    expect(search.controlCharacterSearch).toHaveBeenCalledWith({
      action: 'clear',
      captureId: CAPTURE_ID,
      observationRevision: 2,
      slot: 0
    })

    await hook.unmount()
  })

  it.each([
    { width: 1067, height: 600 },
    { width: 1280, height: 720 },
    { width: 1600, height: 1080 },
    { width: 1920, height: 900 },
    { width: 2560, height: 1440 },
    { width: 3440, height: 1440 },
    { width: 3840, height: 2160 }
  ])('$width×$height 영상에서도 OCR을 시작하고 중지 시 자원을 정리한다', async (dimensions) => {
    const { stream, track, worker } = captureResources()
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(async function (
      this: HTMLMediaElement
    ) {
      loadVideoMetadata(this, dimensions)
    })
    getDisplayMedia.mockResolvedValue(stream)
    moduleMocks.createPartyOcrWorker.mockResolvedValue(worker)
    const hook = await renderPartyCaptureHook()
    await act(async () => hook.getCurrent().selectSource('game'))
    await act(async () => hook.getCurrent().startCapture())

    expect(hook.getCurrent().status).toBe(`캡처 중, ${dimensions.width}×${dimensions.height}`)
    expect(moduleMocks.createPartyOcrWorker).toHaveBeenCalledOnce()
    expect(moduleMocks.runSerialLoop).toHaveBeenCalledOnce()
    expect(track.stop).not.toHaveBeenCalled()

    await hook.unmount()
    expect(track.stop).toHaveBeenCalledOnce()
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it.each([
    { width: 0, height: 1080 },
    { width: 1920, height: 0 },
    { width: 8193, height: 600 },
    { width: 8192, height: 8192 }
  ])('$width×$height 영상 크기를 처리할 수 없으면 OCR 전에 자원을 정리한다', async (dimensions) => {
    const { stream, track } = captureResources()
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(async function (
      this: HTMLMediaElement
    ) {
      loadVideoMetadata(this, dimensions)
    })
    getDisplayMedia.mockResolvedValue(stream)
    const hook = await renderPartyCaptureHook()
    act(() => hook.getCurrent().selectSource('game'))
    await flushPromises()

    await act(async () => hook.getCurrent().startCapture())

    expect(hook.getCurrent().status).toBe(
      '게임 영상의 크기를 처리할 수 없습니다. 창이 최소화되지 않았는지 확인해 주세요.'
    )
    expect(track.stop).toHaveBeenCalledOnce()
    expect(moduleMocks.createPartyOcrWorker).not.toHaveBeenCalled()
    expect(moduleMocks.runSerialLoop).not.toHaveBeenCalled()
    await hook.unmount()
  })

  it('진행 중 영상 크기가 바뀌면 세션을 재시작하지 않고 표시와 다음 OCR 입력을 갱신한다', async () => {
    const { stream, track, worker } = captureResources()
    let loopOptions: LoopOptions | undefined
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(async function (
      this: HTMLMediaElement
    ) {
      loadVideoMetadata(this, { width: 1280, height: 720 })
    })
    getDisplayMedia.mockResolvedValue(stream)
    moduleMocks.createPartyOcrWorker.mockResolvedValue(worker)
    moduleMocks.runSerialLoop.mockImplementation((options: LoopOptions) => {
      loopOptions = options

      return new Promise<void>(() => undefined)
    })
    const hook = await renderPartyCaptureHook()
    await act(async () => hook.getCurrent().selectSource('game'))
    await act(async () => hook.getCurrent().startCapture())
    expect(hook.getCurrent().status).toBe('캡처 중, 1280×720')
    const video = vi.mocked(HTMLMediaElement.prototype.play).mock.contexts[0] as HTMLMediaElement

    await act(async () => {
      loadVideoMetadata(video, { width: 3840, height: 2160 })
      video.dispatchEvent(new Event('resize'))
      await loopOptions!.runCycle()
    })

    expect(hook.getCurrent().status).toBe('캡처 중, 3840×2160')
    expect(moduleMocks.capturePartyNicknameCrops).toHaveBeenLastCalledWith(video)
    expect(getDisplayMedia).toHaveBeenCalledOnce()
    expect(moduleMocks.createPartyOcrWorker).toHaveBeenCalledOnce()
    expect(track.stop).not.toHaveBeenCalled()
    await hook.unmount()
    expect(track.stop).toHaveBeenCalledOnce()
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it.each(['unmount', 'new capture'] as const)(
    '%s 뒤 이전 OCR은 안정화 통지를 보내지 않는다',
    async (mode) => {
      const { stream, worker } = captureResources()
      const crop = document.createElement('canvas')
      const pendingRecognition = Promise.withResolvers<{ data: { text: string } }>()
      let loopOptions: LoopOptions | undefined
      getDisplayMedia.mockResolvedValue(stream)
      moduleMocks.createPartyOcrWorker.mockResolvedValue(worker)
      moduleMocks.capturePartyNicknameCrops.mockReturnValue([crop, null, null, null])
      moduleMocks.runSerialLoop.mockImplementation((options: LoopOptions) => {
        loopOptions = options

        return new Promise<void>(() => undefined)
      })
      const hook = await renderPartyCaptureHook()
      act(() => hook.getCurrent().selectSource('game'))
      await flushPromises()
      await act(async () => hook.getCurrent().startCapture())
      await act(async () => loopOptions?.runCycle())
      worker.recognize.mockReturnValueOnce(pendingRecognition.promise)
      const lateCycle = loopOptions?.runCycle()
      await hook.unmount()
      const shouldRestart = mode === 'new capture'
      const nextHook = shouldRestart ? await renderPartyCaptureHook() : null
      const hasNextHook = nextHook != null
      if (hasNextHook) {
        act(() => nextHook.getCurrent().selectSource('game'))
        await flushPromises()
        await act(async () => nextHook.getCurrent().startCapture())
      }
      pendingRecognition.resolve({ data: { text: 'Alice' } })
      await act(async () => lateCycle)
      expect(api.notifyStableNicknameDetected).not.toHaveBeenCalled()
      if (hasNextHook) {
        expect(nextHook.getCurrent().stableNicknames).toEqual([null, null, null, null])
        expect(nextHook.getCurrent().status).toBe('캡처 중, 1920×1080')
        await nextHook.unmount()
      }
      expect(api.selectCaptureSource).toHaveBeenLastCalledWith('')
    }
  )

  it('stops a stream that resolves after capture was cancelled', async () => {
    const { track, stream } = captureResources()
    const pendingStream = Promise.withResolvers<MediaStream>()

    getDisplayMedia.mockReturnValue(pendingStream.promise)
    const hook = await renderPartyCaptureHook()
    act(() => hook.getCurrent().selectSource('game'))
    await flushPromises()

    let startCapture!: Promise<void>
    act(() => {
      startCapture = hook.getCurrent().startCapture()
    })
    await flushPromises()
    act(() => hook.getCurrent().stopCapture('Capture cancelled.'))
    pendingStream.resolve(stream)
    await act(async () => startCapture)

    expect(track.stop).toHaveBeenCalledOnce()
    expect(moduleMocks.createPartyOcrWorker).not.toHaveBeenCalled()
    expect(hook.getCurrent().status).toBe('Capture cancelled.')

    await hook.unmount()
  })

  it.each(['track ended', 'OCR failed'] as const)(
    'releases the active session when %s',
    async (reason) => {
      const { stream, track, worker } = captureResources()
      const loop = Promise.withResolvers<void>()
      getDisplayMedia.mockResolvedValue(stream)
      moduleMocks.createPartyOcrWorker.mockResolvedValue(worker)
      moduleMocks.runSerialLoop.mockReturnValue(loop.promise)
      const hook = await renderPartyCaptureHook()
      act(() => hook.getCurrent().selectSource('game'))
      await flushPromises()
      await act(async () => hook.getCurrent().startCapture())
      const video = vi.mocked(HTMLMediaElement.prototype.play).mock.contexts[0] as HTMLMediaElement
      const { signal } = moduleMocks.runSerialLoop.mock.calls[0][0] as LoopOptions
      const isTrackEnded = reason === 'track ended'

      if (isTrackEnded) {
        act(() => track.dispatchEvent(new Event('ended')))
      } else {
        await act(async () => loop.reject(new Error('Party OCR failed.')))
      }

      expect(signal.aborted).toBe(true)
      expect(track.stop).toHaveBeenCalledOnce()
      expect(video.pause).toHaveBeenCalledOnce()
      expect(video.srcObject).toBeNull()
      expect(worker.terminate).toHaveBeenCalledOnce()
      expect(hook.getCurrent().status).toBe(
        isTrackEnded
          ? '게임 창의 영상이 종료되었습니다. 창을 다시 선택하고 캡처를 시작해 주세요.'
          : '글자 인식에 실패해 캡처를 중지했습니다. 다시 시작하거나 캐릭터 직접 검색을 사용해 주세요.'
      )
      await hook.unmount()
      expect(track.stop).toHaveBeenCalledOnce()
      expect(worker.terminate).toHaveBeenCalledOnce()
    }
  )

  it.each(['stop', 'unmount'] as const)(
    'releases a video still waiting for playback on %s',
    async (action) => {
      const { stream, track } = captureResources()
      const playback = Promise.withResolvers<void>()
      vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(function (
        this: HTMLMediaElement
      ) {
        loadVideoMetadata(this)

        return playback.promise
      })
      getDisplayMedia.mockResolvedValue(stream)
      const hook = await renderPartyCaptureHook()
      act(() => hook.getCurrent().selectSource('game'))
      await flushPromises()

      let start!: Promise<void>
      act(() => {
        start = hook.getCurrent().startCapture()
      })
      await flushPromises()
      const video = vi.mocked(HTMLMediaElement.prototype.play).mock.contexts[0] as HTMLMediaElement
      const shouldStop = action === 'stop'
      if (shouldStop) {
        act(() => hook.getCurrent().stopCapture('Capture cancelled.'))
      } else {
        await hook.unmount()
      }

      expect(track.stop).toHaveBeenCalledOnce()
      expect(video.pause).toHaveBeenCalledOnce()
      expect(video.srcObject).toBeNull()
      playback.resolve()
      await act(async () => start)
      expect(moduleMocks.createPartyOcrWorker).not.toHaveBeenCalled()
      expect(moduleMocks.runSerialLoop).not.toHaveBeenCalled()
      if (shouldStop) {
        expect(hook.getCurrent().status).toBe('Capture cancelled.')
        await hook.unmount()
      }
      expect(video.pause).toHaveBeenCalledOnce()
    }
  )

  it('cancels metadata waiting without requiring a later video event', async () => {
    const { stream, track } = captureResources()
    vi.mocked(HTMLMediaElement.prototype.play).mockResolvedValueOnce(undefined)
    getDisplayMedia.mockResolvedValue(stream)
    const hook = await renderPartyCaptureHook()
    act(() => hook.getCurrent().selectSource('game'))
    await flushPromises()

    let settled = false
    let start!: Promise<void>
    act(() => {
      start = hook
        .getCurrent()
        .startCapture()
        .then(() => {
          settled = true
        })
    })
    await flushPromises()
    const video = vi.mocked(HTMLMediaElement.prototype.play).mock.contexts[0] as HTMLMediaElement
    act(() => hook.getCurrent().stopCapture('Capture cancelled.'))
    await flushPromises()

    expect(settled).toBe(true)
    await start
    expect(track.stop).toHaveBeenCalledOnce()
    expect(video.srcObject).toBeNull()
    loadVideoMetadata(video)
    await flushPromises()
    expect(moduleMocks.createPartyOcrWorker).not.toHaveBeenCalled()
    expect(hook.getCurrent().status).toBe('Capture cancelled.')
    await hook.unmount()
  })

  it('releases a late stream without stopping the replacement session', async () => {
    const previous = captureResources()
    const current = captureResources()
    const pendingStream = Promise.withResolvers<MediaStream>()
    getDisplayMedia.mockReturnValueOnce(pendingStream.promise).mockResolvedValue(current.stream)
    moduleMocks.createPartyOcrWorker.mockResolvedValue(current.worker)
    const hook = await renderPartyCaptureHook()
    act(() => hook.getCurrent().selectSource('game'))
    await flushPromises()

    let firstStart!: Promise<void>
    act(() => {
      firstStart = hook.getCurrent().startCapture()
    })
    await flushPromises()
    await act(async () => hook.getCurrent().startCapture())
    pendingStream.resolve(previous.stream)
    await act(async () => firstStart)

    expect(previous.track.stop).toHaveBeenCalledOnce()
    expect(current.track.stop).not.toHaveBeenCalled()
    expect(current.worker.terminate).not.toHaveBeenCalled()
    expect(moduleMocks.runSerialLoop).toHaveBeenCalledOnce()
    expect(hook.getCurrent().status).toBe('캡처 중, 1920×1080')
    await hook.unmount()
  })

  it.each(['resolve', 'reject'] as const)(
    'ignores an old worker initialization that later %ss after restart',
    async (outcome) => {
      const previous = captureResources()
      const current = captureResources()
      const pendingWorker = Promise.withResolvers<typeof previous.worker>()
      getDisplayMedia.mockResolvedValueOnce(previous.stream).mockResolvedValue(current.stream)
      moduleMocks.createPartyOcrWorker
        .mockReturnValueOnce(pendingWorker.promise)
        .mockResolvedValue(current.worker)
      const hook = await renderPartyCaptureHook()
      act(() => hook.getCurrent().selectSource('game'))
      await flushPromises()

      let firstStart!: Promise<void>
      act(() => {
        firstStart = hook.getCurrent().startCapture()
      })
      await flushPromises()
      expect(moduleMocks.createPartyOcrWorker).toHaveBeenCalledOnce()
      await act(async () => hook.getCurrent().startCapture())
      const shouldResolve = outcome === 'resolve'
      if (shouldResolve) {
        pendingWorker.resolve(previous.worker)
      } else {
        pendingWorker.reject(new Error('Old worker failed.'))
      }
      await act(async () => firstStart)

      expect(previous.track.stop).toHaveBeenCalledOnce()
      expect(previous.worker.terminate).toHaveBeenCalledTimes(shouldResolve ? 1 : 0)
      expect(previous.worker.recognize).not.toHaveBeenCalled()
      expect(current.track.stop).not.toHaveBeenCalled()
      expect(current.worker.terminate).not.toHaveBeenCalled()
      expect(moduleMocks.runSerialLoop).toHaveBeenCalledOnce()
      expect(hook.getCurrent().status).toBe('캡처 중, 1920×1080')
      previous.track.dispatchEvent(new Event('ended'))
      expect(current.track.stop).not.toHaveBeenCalled()
      await hook.unmount()
    }
  )

  it('terminates a worker that finishes initialization after unmount', async () => {
    const { stream, track, worker } = captureResources()
    const pendingWorker = Promise.withResolvers<typeof worker>()
    getDisplayMedia.mockResolvedValue(stream)
    moduleMocks.createPartyOcrWorker.mockReturnValue(pendingWorker.promise)
    const hook = await renderPartyCaptureHook()
    act(() => hook.getCurrent().selectSource('game'))
    await flushPromises()

    let start!: Promise<void>
    act(() => {
      start = hook.getCurrent().startCapture()
    })
    await flushPromises()
    await hook.unmount()
    pendingWorker.resolve(worker)
    await act(async () => start)

    expect(track.stop).toHaveBeenCalledOnce()
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(worker.recognize).not.toHaveBeenCalled()
    expect(moduleMocks.runSerialLoop).not.toHaveBeenCalled()
  })

  it('releases a video when playback fails', async () => {
    const { stream, track } = captureResources()
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error('Playback failed.'))
    getDisplayMedia.mockResolvedValue(stream)
    const hook = await renderPartyCaptureHook()
    act(() => hook.getCurrent().selectSource('game'))
    await flushPromises()

    await act(async () => hook.getCurrent().startCapture())

    const video = vi.mocked(HTMLMediaElement.prototype.play).mock.contexts[0] as HTMLMediaElement
    expect(track.stop).toHaveBeenCalledOnce()
    expect(video.pause).toHaveBeenCalledOnce()
    expect(video.srcObject).toBeNull()
    expect(hook.getCurrent().status).toBe(
      '게임 영상을 재생하지 못했습니다. 게임 창을 확인하고 다시 시작해 주세요.'
    )
    expect(moduleMocks.createPartyOcrWorker).not.toHaveBeenCalled()
    await hook.unmount()
  })

  it('releases all stream tracks when no video track is available', async () => {
    const { stream, track } = captureResources()
    stream.getVideoTracks = () => []
    getDisplayMedia.mockResolvedValue(stream)
    const hook = await renderPartyCaptureHook()
    act(() => hook.getCurrent().selectSource('game'))
    await flushPromises()

    await act(async () => hook.getCurrent().startCapture())

    expect(track.stop).toHaveBeenCalledOnce()
    expect(hook.getCurrent().status).toBe(
      '선택한 창에서 영상을 받지 못했습니다. 게임 창을 다시 선택해 주세요.'
    )
    expect(moduleMocks.createPartyOcrWorker).not.toHaveBeenCalled()
    await hook.unmount()
  })
})

it('창 선택 등록이 완료되면 별도 시작 없이 캡처를 시작한다', async () => {
  const { stream, worker } = captureResources()
  getDisplayMedia.mockResolvedValue(stream)
  moduleMocks.createPartyOcrWorker.mockResolvedValue(worker)
  const hook = await renderPartyCaptureHook()
  await act(async () => hook.getCurrent().selectAndStartCapture('game'))
  expect(api.selectCaptureSource).toHaveBeenCalledWith('game')
  expect(getDisplayMedia).toHaveBeenCalledOnce()
  expect(hook.getCurrent().status).toBe('캡처 중, 1920×1080')
  await hook.unmount()
})

it('창을 연속 선택하면 늦게 등록된 이전 선택은 캡처를 시작하지 않는다', async () => {
  const oldSelection = Promise.withResolvers<null>()
  const { stream, worker } = captureResources()
  getDisplayMedia.mockResolvedValue(stream)
  moduleMocks.createPartyOcrWorker.mockResolvedValue(worker)
  api.selectCaptureSource.mockReturnValueOnce(oldSelection.promise)
  const hook = await renderPartyCaptureHook()
  let oldStart!: Promise<void>
  await act(async () => {
    oldStart = hook.getCurrent().selectAndStartCapture('old')
  })
  await act(async () => hook.getCurrent().selectAndStartCapture('new'))
  await act(async () => {
    oldSelection.resolve(null)
    await oldStart
  })
  expect(hook.getCurrent().selectedSourceId).toBe('new')
  expect(getDisplayMedia).toHaveBeenCalledOnce()
  await hook.unmount()
})

it.each(['stop', 'unmount', 'failure'] as const)(
  '선택 대기 중 %s 이후에는 자동으로 시작하지 않는다',
  async (action) => {
    const selection = Promise.withResolvers<null>()
    api.selectCaptureSource.mockReturnValueOnce(selection.promise)
    const hook = await renderPartyCaptureHook()
    let start!: Promise<void>
    await act(async () => {
      start = hook.getCurrent().selectAndStartCapture('game')
    })
    if (action === 'stop') {
      await act(async () => hook.getCurrent().stopCapture())
    }

    if (action === 'unmount') {
      await hook.unmount()
    }
    await act(async () => {
      if (action === 'failure') {
        selection.reject(new Error('Selection failed'))
      } else {
        selection.resolve(null)
      }
      await start
    })
    expect(getDisplayMedia).not.toHaveBeenCalled()
    if (action !== 'unmount') {
      await hook.unmount()
    }
  }
)

it('이전 창 등록 완료가 새 창의 준비 상태를 해제하지 않는다', async () => {
  const oldSelection = Promise.withResolvers<null>()
  const newSelection = Promise.withResolvers<null>()
  api.selectCaptureSource
    .mockReturnValueOnce(oldSelection.promise)
    .mockReturnValueOnce(newSelection.promise)
  const hook = await renderPartyCaptureHook()
  let oldStart!: Promise<void>
  let newStart!: Promise<void>
  await act(async () => {
    oldStart = hook.getCurrent().selectAndStartCapture('old')
  })
  await act(async () => {
    newStart = hook.getCurrent().selectAndStartCapture('new')
  })
  await act(async () => {
    oldSelection.resolve(null)
    await oldStart
  })
  expect(hook.getCurrent().starting).toBe(true)
  expect(hook.getCurrent().selectedSourceId).toBe('new')
  await act(async () => {
    newSelection.reject(new Error('Selection failed'))
    await newStart
  })
  expect(hook.getCurrent().starting).toBe(false)
  expect(hook.getCurrent().status).toBe('게임 창을 선택하지 못했습니다. 창을 다시 선택해 주세요.')
  expect(getDisplayMedia).not.toHaveBeenCalled()
  await hook.unmount()
})

it('StrictMode 재마운트 뒤 선택·시작과 종료 정리를 정상 수행한다', async () => {
  const resources = captureResources()
  getDisplayMedia.mockResolvedValue(resources.stream)
  moduleMocks.createPartyOcrWorker.mockResolvedValue(resources.worker)
  const hook = await renderPartyCaptureHook(true)
  api.selectCaptureSource.mockClear()

  await act(async () => hook.getCurrent().selectAndStartCapture('game'))
  expect(hook.getCurrent().phase).toBe('active')
  expect(api.selectCaptureSource).toHaveBeenCalledExactlyOnceWith('game')
  expect(getDisplayMedia).toHaveBeenCalledOnce()
  expect(resources.track.stop).not.toHaveBeenCalled()

  await hook.unmount()
  expect(resources.track.stop).toHaveBeenCalledOnce()
  expect(resources.worker.terminate).toHaveBeenCalledOnce()
  expect(api.selectCaptureSource).toHaveBeenLastCalledWith('')
})

it('캡처 중 목록 새로고침이 실패해도 실행 중인 자원과 단계를 유지한다', async () => {
  const resources = captureResources()
  getDisplayMedia.mockResolvedValue(resources.stream)
  moduleMocks.createPartyOcrWorker.mockResolvedValue(resources.worker)
  const hook = await renderPartyCaptureHook()
  await act(async () => hook.getCurrent().selectAndStartCapture('game'))
  const captureStatus = hook.getCurrent().status
  const list = Promise.withResolvers<{ id: string; name: string }[]>()
  api.listCaptureSources.mockReturnValueOnce(list.promise)

  await act(async () => hook.getCurrent().refreshSources())
  expect(hook.getCurrent().sourcesLoading).toBe(true)
  expect(hook.getCurrent().phase).toBe('active')
  await act(async () => list.reject(new Error('synthetic list failure')))
  expect(hook.getCurrent().sourcesFailed).toBe(true)
  expect(hook.getCurrent().phase).toBe('active')
  expect(resources.track.stop).not.toHaveBeenCalled()
  expect(hook.getCurrent().status).toBe(captureStatus)
  expect(resources.worker.terminate).not.toHaveBeenCalled()
  expect(getDisplayMedia).toHaveBeenCalledOnce()
  await hook.unmount()
})

it('검색 시작 응답 대기 중 반복 시작은 동일한 캡처를 유지한다', async () => {
  const resources = captureResources()
  getDisplayMedia.mockResolvedValue(resources.stream)
  moduleMocks.createPartyOcrWorker.mockResolvedValue(resources.worker)
  const hook = await renderPartyCaptureHook()
  await act(async () => hook.getCurrent().selectSource('game'))
  const begin =
    Promise.withResolvers<Awaited<ReturnType<typeof window.search.controlCharacterSearch>>>()
  search.controlCharacterSearch.mockImplementation((control: SearchControl) => {
    if (control.action === 'begin') {
      return begin.promise
    }

    return Promise.resolve({ ok: true, snapshot: currentSearch })
  })
  search.controlCharacterSearch.mockClear()
  let start!: Promise<void>
  await act(async () => {
    start = hook.getCurrent().startCapture()
  })
  expect(hook.getCurrent().phase).toBe('starting')
  await act(async () => hook.getCurrent().startCapture())
  expect(
    search.controlCharacterSearch.mock.calls.filter(([control]) => control.action === 'begin')
  ).toHaveLength(1)
  expect(getDisplayMedia).not.toHaveBeenCalled()
  await act(async () => {
    begin.resolve({
      ok: true,
      snapshot: searchSnapshot({ captureId: CAPTURE_ID, revision: currentSearch.revision + 1 })
    })
    await start
  })
  expect(hook.getCurrent().phase).toBe('active')
  expect(getDisplayMedia).toHaveBeenCalledOnce()
  await hook.unmount()
})

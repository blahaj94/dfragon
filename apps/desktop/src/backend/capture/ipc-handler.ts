import type { WindowFrameResult } from '../../preload/common/types/capture'
import { SEARCH_ACTIONS, SEARCH_COMMAND_ERRORS } from '../../preload/common/types/search'
import {
  desktopCapturer,
  ipcMain,
  type BrowserWindow,
  type IpcMainInvokeEvent,
  type WebFrameMain
} from 'electron'
import { addHandler } from '../ipc'
import type { MonotonicClock } from '../lib/monotonic-clock'
import {
  createCaptureSearchLifetime,
  type CaptureSearchLifetime,
  type CaptureBinding
} from '../search/capture-lifetime'
import { parseSearchControl, parseOcrSearchObservation } from '../search/commands'
import {
  createCharacterCandidatesHttp,
  createCharacterDetailsHttp,
  createCharacterImageHttp
} from '../search/character-http'
import { createCharacterImageSource } from '../search/character-image-source'
import {
  createCachedCharacterCandidates,
  createCachedCharacterDetails
} from '../search/character-response-cache'
import { createPortraitColorScorer, type PortraitColorPolicy } from '../search/portrait-color'
import type { CharacterSelectionPolicy } from '../search/identify'
import type { SearchRuntime } from '../search/request'
import type { ScoreEngine } from '../score/engine'
import { registerManualSearchIpc, type ManualSearchKind } from '../search/manual-ipc'
import { findSelectedSource } from './capture-policy'
import { bindWindowFrame, type ReadWindowFrame } from './native-frame'
import { toRaidFrameResult } from './raid-frame'

let captureWindow: BrowserWindow | null = null
let documentUrl: string | null = null
let windowGeneration = 0
let sourceSelectionGeneration = 0
let selectedSourceId: string | null = null
let readSelectedFrame: ReadWindowFrame | null = null
let selectingSource = false
let search: CaptureSearchLifetime | undefined
// 파티 카드와 공대 카드의 서버 지정 조회. 캡처와 별도 수명이고 문서가 바뀌면 함께 무효화한다.
let cardSearches: ReturnType<typeof registerManualSearchIpc>[] = []

async function getWindowSources(): Promise<Electron.DesktopCapturerSource[]> {
  return desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 0, height: 0 },
    fetchWindowIcons: false
  })
}

function clearSource(): void {
  selectedSourceId = null
  readSelectedFrame = null
  selectingSource = false
  sourceSelectionGeneration += 1
  search?.invalidate()
  // 카드 조회 결과는 남기고, 이전 창으로 시작한 공대 캡처의 진행 중 OCR 요청만 끝낸다.
  for (const cardSearch of cardSearches) {
    cardSearch.cancelOcrRequests()
  }
}

function invalidateCardSearches(): void {
  for (const cardSearch of cardSearches) {
    cardSearch.invalidate()
  }
}

function isTrustedFrame(window: BrowserWindow | null, frame: WebFrameMain | null): boolean {
  return (
    window != null &&
    window === captureWindow &&
    !window.isDestroyed() &&
    !window.webContents.isDestroyed() &&
    frame != null &&
    frame === window.webContents.mainFrame &&
    !frame.isDestroyed() &&
    frame.url === documentUrl
  )
}

function requireSender(event: IpcMainInvokeEvent, expected = captureWindow): void {
  if (!isTrustedFrame(expected, event.senderFrame) || event.sender !== expected?.webContents) {
    throw new Error('Capture source access denied')
  }
}

function requireSearchSender(event: IpcMainInvokeEvent): void {
  if (
    !isTrustedFrame(captureWindow, event.senderFrame) ||
    event.sender !== captureWindow?.webContents
  ) {
    throw new Error(SEARCH_COMMAND_ERRORS.SEARCH_NOT_ALLOWED)
  }
}

function isCurrentCapture(startedWindowGeneration: number): boolean {
  return windowGeneration === startedWindowGeneration
}

function currentMainFrame(): WebFrameMain | null {
  const window = captureWindow
  if (window == null || window.isDestroyed() || window.webContents.isDestroyed()) {
    return null
  }

  return window.webContents.mainFrame
}

function isCurrentSearch(binding: CaptureBinding): boolean {
  return (
    binding.windowGeneration === windowGeneration &&
    binding.sourceGeneration === sourceSelectionGeneration &&
    selectedSourceId != null &&
    !selectingSource &&
    isTrustedFrame(captureWindow, currentMainFrame())
  )
}

function isReadableCapture(binding: CaptureBinding, args: readonly unknown[]): boolean {
  return args.length === 1 && binding.captureId === args[0] && isCurrentSearch(binding)
}

type CaptureOwner = { readonly current: CaptureBinding | null }

function isSameFrameRead(
  owner: CaptureOwner,
  binding: CaptureBinding,
  readFrame: ReadWindowFrame
): boolean {
  return owner.current === binding && isCurrentSearch(binding) && readSelectedFrame === readFrame
}

async function readBoundCaptureFrame(
  event: IpcMainInvokeEvent,
  args: readonly unknown[],
  owner: CaptureOwner
): Promise<WindowFrameResult> {
  requireSearchSender(event)
  const binding = owner.current
  if (binding == null || !isReadableCapture(binding, args)) {
    throw new Error('CAPTURE_NOT_ALLOWED')
  }
  const readFrame = readSelectedFrame
  if (readFrame === null) {
    throw new Error('CAPTURE_NOT_ALLOWED')
  }
  const result = await readFrame()
  requireSearchSender(event)
  if (!isSameFrameRead(owner, binding, readFrame)) {
    throw new Error('CAPTURE_NOT_ALLOWED')
  }

  return result
}

type SearchConfiguration = {
  apiOrigin: string
  fetch?: typeof fetch
  clock: MonotonicClock
  portraitColorPolicy: PortraitColorPolicy & CharacterSelectionPolicy
  score: ScoreEngine
}

function createSearchRuntime(
  configuration: SearchConfiguration | undefined
): SearchRuntime | undefined {
  if (configuration === undefined) {
    return undefined
  }
  const policy = configuration.portraitColorPolicy
  const scorePortrait = createPortraitColorScorer(policy)
  const candidates = createCachedCharacterCandidates(createCharacterCandidatesHttp(configuration))
  const image = createCharacterImageSource({ image: createCharacterImageHttp(configuration) })
  const details = createCachedCharacterDetails(createCharacterDetailsHttp(configuration))

  return {
    clock: configuration.clock,
    score: configuration.score,
    identification: { candidates, image, details, scorePortrait, selection: policy }
  }
}

function registerCaptureIpc(configuration?: SearchConfiguration): () => void {
  const runtime = createSearchRuntime(configuration)
  const lifetime = createCaptureSearchLifetime({
    runtime,
    isCurrent: isCurrentSearch,
    publish: (snapshot) => {
      if (isTrustedFrame(captureWindow, currentMainFrame())) {
        captureWindow!.webContents.send('characterSearchChanged', snapshot)
      }
    }
  })
  invalidateCardSearches()
  const registerCardSearch = (kind: ManualSearchKind): ReturnType<typeof registerManualSearchIpc> =>
    registerManualSearchIpc({
      kind,
      runtime,
      requireSender: requireSearchSender,
      windowGeneration: () => windowGeneration,
      sourceGeneration: () => sourceSelectionGeneration,
      isCurrentCaptureSource: isCurrentSearch,
      isCurrentDocument: (generation) =>
        generation === windowGeneration && isTrustedFrame(captureWindow, currentMainFrame()),
      publish: (channel, snapshot) => {
        if (isTrustedFrame(captureWindow, currentMainFrame())) {
          captureWindow!.webContents.send(channel, snapshot)
        }
      }
    })
  const manual = registerCardSearch('party')
  const raid = registerCardSearch('raid')
  cardSearches = [manual, raid]
  search = lifetime
  clearSource()
  addHandler('listCaptureSources', async (event, ...args) => {
    const window = captureWindow
    const startedWindowGeneration = windowGeneration
    requireSender(event, window)
    if (args.length !== 0) {
      throw new Error('Capture source access denied')
    }
    const sources = await getWindowSources()
    requireSender(event, window)
    if (!isCurrentCapture(startedWindowGeneration)) {
      throw new Error('Capture source access denied')
    }

    return sources.map(({ id, name }) => ({ id, name }))
  })

  addHandler('selectCaptureSource', async (event, ...args) => {
    const window = captureWindow
    const startedWindowGeneration = windowGeneration
    requireSender(event, window)
    const sourceId = args[0]
    if (args.length !== 1 || typeof sourceId !== 'string') {
      throw new Error('Capture source selection denied')
    }
    clearSource()
    if (sourceId.length === 0) {
      return null
    }
    const selectionGeneration = sourceSelectionGeneration
    selectingSource = true
    try {
      const source = findSelectedSource(await getWindowSources(), sourceId)
      requireSender(event, window)
      if (!isCurrentCapture(startedWindowGeneration)) {
        throw new Error('Capture source selection denied')
      }

      if (selectionGeneration !== sourceSelectionGeneration) {
        return null
      }

      if (source == null) {
        throw new Error('Selected capture source is no longer available')
      }
      const readFrame = bindWindowFrame(source.id)
      selectedSourceId = source.id
      readSelectedFrame = readFrame

      return { id: source.id, name: source.name }
    } finally {
      if (selectionGeneration === sourceSelectionGeneration) {
        selectingSource = false
      }
    }
  })

  addHandler('readCaptureFrame', (event, ...args) => readBoundCaptureFrame(event, args, lifetime))

  addHandler('readRaidCaptureFrame', async (event, ...args) =>
    toRaidFrameResult(await readBoundCaptureFrame(event, args, raid))
  )

  addHandler('controlCharacterSearch', (event, ...args) => {
    requireSearchSender(event)
    const control = parseSearchControl(args)
    if (control == null) {
      return lifetime.result(SEARCH_COMMAND_ERRORS.INVALID_SEARCH_COMMAND)
    }
    switch (control.action) {
      case SEARCH_ACTIONS.READ:
        return lifetime.result()
      case SEARCH_ACTIONS.END:
        return lifetime.end(control.captureId)
      case SEARCH_ACTIONS.RETRY:
        return lifetime.retry(control)
      case SEARCH_ACTIONS.LOOKUP:
        // 서버 지정 조회는 controlManualSearch와 controlRaidSearch로만 받는다. 공유 schema가 LOOKUP을
        // 통과시키므로 여기서 거절한다.
        return lifetime.result(SEARCH_COMMAND_ERRORS.INVALID_SEARCH_COMMAND)
      case SEARCH_ACTIONS.BEGIN:
        if (selectingSource || lifetime.current != null) {
          return lifetime.result(SEARCH_COMMAND_ERRORS.SEARCH_BUSY)
        }

        if (selectedSourceId == null) {
          return lifetime.result(SEARCH_COMMAND_ERRORS.SEARCH_NOT_ALLOWED)
        }

        return lifetime.begin({
          windowGeneration,
          sourceGeneration: sourceSelectionGeneration
        })
    }
  })

  addHandler('notifyOcrCandidatesDetected', (event, ...args) => {
    requireSearchSender(event)
    const observation = parseOcrSearchObservation(args)
    if (observation === null) {
      return lifetime.result(SEARCH_COMMAND_ERRORS.INVALID_SEARCH_COMMAND)
    }

    return lifetime.observeOcr(observation)
  })

  return () => {
    manual.dispose()
    raid.dispose()
    clearSource()
    ipcMain.removeHandler('listCaptureSources')
    ipcMain.removeHandler('selectCaptureSource')
    ipcMain.removeHandler('readCaptureFrame')
    ipcMain.removeHandler('readRaidCaptureFrame')
    ipcMain.removeHandler('notifyOcrCandidatesDetected')
    ipcMain.removeHandler('controlCharacterSearch')
  }
}

function invalidateCaptureDocument(): void {
  windowGeneration += 1
  clearSource()
  invalidateCardSearches()
}

function registerCaptureWindow(window: BrowserWindow, rendererDocumentUrl: string): void {
  captureWindow = window
  documentUrl = rendererDocumentUrl
  invalidateCaptureDocument()
  window.webContents.session.setDisplayMediaRequestHandler((_request, callback) => {
    try {
      callback(null)
    } catch {
      // Native once callback은 throw 전에 소비될 수 있으므로 재호출하지 않는다.
    }
  })
  const invalidateIfCurrent = (): void => {
    if (captureWindow === window) {
      invalidateCaptureDocument()
    }
  }

  window.webContents.on('did-start-navigation', (_event, _url, _isInPlace, isMainFrame) => {
    if (isMainFrame) {
      invalidateIfCurrent()
    }
  })
  window.webContents.on('destroyed', invalidateIfCurrent)
  window.webContents.on('render-process-gone', invalidateIfCurrent)
  window.on('closed', () => {
    if (captureWindow !== window) {
      return
    }
    captureWindow = null
    documentUrl = null
    invalidateCaptureDocument()
  })
}

export { registerCaptureIpc, registerCaptureWindow }

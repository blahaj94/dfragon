import type { WindowFrameResult } from '../../preload/common/types/capture'
import { SEARCH_COMMAND_ERRORS } from '../../preload/common/types/search'
import {
  desktopCapturer,
  ipcMain,
  type BrowserWindow,
  type IpcMainInvokeEvent,
  type WebFrameMain
} from 'electron'
import { addHandler } from '../ipc'
import type { CaptureBinding } from '../search/capture-lifetime'
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
// 파티 화면과 공대 화면의 검색 수명. 문서가 바뀌면 함께 무효화한다.
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
  // 끝난 슬롯과 직접 조회 결과는 남기고, 이전 창으로 시작한 회차의 진행 중 OCR 요청만 끝낸다.
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
  portraitColorPolicy: PortraitColorPolicy & CharacterSelectionPolicy
  scoreEngine: ScoreEngine
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
    scoreEngine: configuration.scoreEngine,
    identification: { candidates, image, details, scorePortrait, selection: policy }
  }
}

function registerCaptureIpc(configuration?: SearchConfiguration): () => void {
  const runtime = createSearchRuntime(configuration)
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
  const party = registerCardSearch('party')
  const raid = registerCardSearch('raid')
  cardSearches = [party, raid]
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

  addHandler('readCaptureFrame', (event, ...args) => readBoundCaptureFrame(event, args, party))

  addHandler('readRaidCaptureFrame', async (event, ...args) =>
    toRaidFrameResult(await readBoundCaptureFrame(event, args, raid))
  )

  return () => {
    party.dispose()
    raid.dispose()
    clearSource()
    ipcMain.removeHandler('listCaptureSources')
    ipcMain.removeHandler('selectCaptureSource')
    ipcMain.removeHandler('readCaptureFrame')
    ipcMain.removeHandler('readRaidCaptureFrame')
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

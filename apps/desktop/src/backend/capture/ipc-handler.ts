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
import { validateSelectionPolicy, type CharacterSelectionPolicy } from '../search/identify'
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
  const hasWindow = window != null
  if (!hasWindow) {
    return false
  }

  const isRegisteredWindow = window === captureWindow
  if (!isRegisteredWindow) {
    return false
  }

  const isWindowAlive = !window.isDestroyed()
  if (!isWindowAlive) {
    return false
  }

  const isContentsAlive = !window.webContents.isDestroyed()
  if (!isContentsAlive) {
    return false
  }

  const hasFrame = frame != null
  if (!hasFrame) {
    return false
  }

  const isMainFrame = frame === window.webContents.mainFrame
  if (!isMainFrame) {
    return false
  }

  const isFrameAlive = !frame.isDestroyed()
  if (!isFrameAlive) {
    return false
  }

  const hasExactDocument = frame.url === documentUrl

  return hasExactDocument
}

function requireSender(event: IpcMainInvokeEvent, expected = captureWindow): void {
  const isTrusted = isTrustedFrame(expected, event.senderFrame)
  const isSender = event.sender === expected?.webContents
  const isAllowed = isTrusted && isSender
  if (!isAllowed) {
    throw new Error('Capture source access denied')
  }
}

function requireSearchSender(event: IpcMainInvokeEvent): void {
  const isTrusted = isTrustedFrame(captureWindow, event.senderFrame)
  const isSender = event.sender === captureWindow?.webContents
  const isAllowed = isTrusted && isSender
  if (!isAllowed) {
    throw new Error(SEARCH_COMMAND_ERRORS.SEARCH_NOT_ALLOWED)
  }
}

function isCurrentCapture(startedWindowGeneration: number): boolean {
  return windowGeneration === startedWindowGeneration
}

function currentMainFrame(): WebFrameMain | null {
  const window = captureWindow
  const hasWindow = window != null
  if (!hasWindow) {
    return null
  }

  const isWindowAlive = !window.isDestroyed()
  if (!isWindowAlive) {
    return null
  }

  const isContentsAlive = !window.webContents.isDestroyed()
  if (!isContentsAlive) {
    return null
  }

  return window.webContents.mainFrame
}

function isCurrentSearch(binding: CaptureBinding): boolean {
  const hasSameWindow = binding.windowGeneration === windowGeneration
  const hasSameSource = binding.sourceGeneration === sourceSelectionGeneration
  const hasSelectedSource = selectedSourceId != null
  const isSourceSelectionComplete = !selectingSource
  const hasSource = hasSelectedSource && isSourceSelectionComplete
  const isTrusted = isTrustedFrame(captureWindow, currentMainFrame())
  const isCurrent = hasSameWindow && hasSameSource && hasSource && isTrusted

  return isCurrent
}

function isReadableCapture(binding: CaptureBinding, args: readonly unknown[]): boolean {
  const [captureId] = args
  if (args.length !== 1 || typeof captureId !== 'string') {
    return false
  }

  if (binding.captureId !== captureId) {
    return false
  }

  return isCurrentSearch(binding)
}

type CaptureOwner = { readonly current: CaptureBinding | null }

function isSameFrameRead(
  owner: CaptureOwner,
  binding: CaptureBinding,
  readFrame: ReadWindowFrame
): boolean {
  if (owner.current !== binding) {
    return false
  }

  if (!isCurrentSearch(binding)) {
    return false
  }

  return readSelectedFrame === readFrame
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
  // 잘못된 정책은 요청마다 실패하지 않도록 등록할 때 거절한다.
  const scorePortrait = createPortraitColorScorer(policy)
  const { maxDistance, minMargin, maxCandidates } = policy
  const selection = { maxDistance, minMargin, maxCandidates }
  validateSelectionPolicy(selection)
  const candidates = createCachedCharacterCandidates(createCharacterCandidatesHttp(configuration))
  const image = createCharacterImageSource({ image: createCharacterImageHttp(configuration) })
  const details = createCachedCharacterDetails(createCharacterDetailsHttp(configuration))

  return {
    clock: configuration.clock,
    score: configuration.score,
    identification: { candidates, image, details, scorePortrait, selection }
  }
}

function registerCaptureIpc(configuration?: SearchConfiguration): () => void {
  const runtime = createSearchRuntime(configuration)
  const lifetime = createCaptureSearchLifetime({
    runtime,
    isCurrent: isCurrentSearch,
    publish: (snapshot) => {
      const window = captureWindow
      const canPublish = isTrustedFrame(window, currentMainFrame())
      if (canPublish) {
        window!.webContents.send('characterSearchChanged', snapshot)
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
    const hasNoArguments = args.length === 0
    if (!hasNoArguments) {
      throw new Error('Capture source access denied')
    }
    const sources = await getWindowSources()
    requireSender(event, window)
    const isCurrent = isCurrentCapture(startedWindowGeneration)
    if (!isCurrent) {
      throw new Error('Capture source access denied')
    }

    return sources.map(({ id, name }) => ({ id, name }))
  })

  addHandler('selectCaptureSource', async (event, ...args) => {
    const window = captureWindow
    const startedWindowGeneration = windowGeneration
    requireSender(event, window)
    const sourceId = args[0]
    const hasOneArgument = args.length === 1
    const isSourceIdString = typeof sourceId === 'string'
    const hasValidArgument = hasOneArgument && isSourceIdString
    if (!hasValidArgument) {
      throw new Error('Capture source selection denied')
    }
    const isCleanup = sourceId.length === 0
    if (isCleanup) {
      clearSource()

      return null
    }
    clearSource()
    const selectionGeneration = sourceSelectionGeneration
    selectingSource = true
    try {
      const source = findSelectedSource(await getWindowSources(), sourceId)
      requireSender(event, window)
      const isCurrent = isCurrentCapture(startedWindowGeneration)
      if (!isCurrent) {
        throw new Error('Capture source selection denied')
      }
      const isLatestSelection = selectionGeneration === sourceSelectionGeneration
      if (!isLatestSelection) {
        return null
      }
      const hasSource = source != null
      if (!hasSource) {
        throw new Error('Selected capture source is no longer available')
      }
      const readFrame = bindWindowFrame(source.id)
      selectedSourceId = source.id
      readSelectedFrame = readFrame

      return { id: source.id, name: source.name }
    } finally {
      const isLatestSelection = selectionGeneration === sourceSelectionGeneration
      if (isLatestSelection) {
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
    const hasValidControl = control != null
    if (!hasValidControl) {
      return lifetime.result(SEARCH_COMMAND_ERRORS.INVALID_SEARCH_COMMAND)
    }
    const isRead = control.action === SEARCH_ACTIONS.READ
    if (isRead) {
      return lifetime.result()
    }
    const isEnd = control.action === SEARCH_ACTIONS.END
    if (isEnd) {
      return lifetime.end(control.captureId)
    }

    const isRetry = control.action === SEARCH_ACTIONS.RETRY
    if (isRetry) {
      return lifetime.retry(control)
    }

    // 서버 지정 조회는 controlManualSearch와 controlRaidSearch로만 받는다. 공유 schema가 LOOKUP을
    // 통과시키므로 여기서 거부하지 않으면 BEGIN으로 처리된다.
    if (control.action === SEARCH_ACTIONS.LOOKUP) {
      return lifetime.result(SEARCH_COMMAND_ERRORS.INVALID_SEARCH_COMMAND)
    }
    const hasCapture = lifetime.current != null
    const isBusy = selectingSource || hasCapture
    if (isBusy) {
      return lifetime.result(SEARCH_COMMAND_ERRORS.SEARCH_BUSY)
    }
    const hasSource = selectedSourceId != null
    if (!hasSource) {
      return lifetime.result(SEARCH_COMMAND_ERRORS.SEARCH_NOT_ALLOWED)
    }

    return lifetime.begin({
      windowGeneration,
      sourceGeneration: sourceSelectionGeneration
    })
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

function registerCaptureWindow(window: BrowserWindow, rendererDocumentUrl: string): void {
  captureWindow = window
  documentUrl = rendererDocumentUrl
  windowGeneration += 1
  clearSource()
  invalidateCardSearches()
  window.webContents.session.setDisplayMediaRequestHandler((_request, callback) => {
    try {
      callback(null)
    } catch {
      // Native once callback은 throw 전에 소비될 수 있으므로 재호출하지 않는다.
    }
  })

  window.webContents.on('did-start-navigation', (_event, _url, _isInPlace, isMainFrame) => {
    const isCurrentWindow = captureWindow === window
    const shouldInvalidate = isCurrentWindow && isMainFrame
    if (!shouldInvalidate) {
      return
    }
    windowGeneration += 1
    clearSource()
    invalidateCardSearches()
  })
  window.webContents.on('destroyed', () => {
    const isCurrentWindow = captureWindow === window
    if (!isCurrentWindow) {
      return
    }
    windowGeneration += 1
    clearSource()
    invalidateCardSearches()
  })
  window.webContents.on('render-process-gone', () => {
    const isCurrentWindow = captureWindow === window
    if (!isCurrentWindow) {
      return
    }
    windowGeneration += 1
    clearSource()
    invalidateCardSearches()
  })
  window.on('closed', () => {
    const isCurrentWindow = captureWindow === window
    if (!isCurrentWindow) {
      return
    }
    captureWindow = null
    documentUrl = null
    windowGeneration += 1
    clearSource()
    invalidateCardSearches()
  })
}

export { registerCaptureIpc, registerCaptureWindow }

import { SEARCH_ACTIONS, SEARCH_COMMAND_ERRORS } from '../../preload/common/types/search'
import {
  desktopCapturer,
  ipcMain,
  type BrowserWindow,
  type IpcMainInvokeEvent,
  type WebContents,
  type WebFrameMain
} from 'electron'
import { addHandler } from '../ipc'
import type { AuthClock } from '../auth/types'
import {
  createCaptureSearchLifetime,
  type CaptureSearchLifetime,
  type CaptureBinding
} from '../search/capture-lifetime'
import {
  parseSearchControl,
  parseSearchObservation,
  parseOcrSearchObservation,
  parseCharacterSelection
} from '../search/commands'
import type { openSelectedCharacterDetail } from '../character-detail/windows'
import { createSearchHttp } from '../search/http'
import {
  createCharacterCandidatesHttp,
  createCharacterAppearanceHttp,
  createCharacterDetailsHttp,
  createCharacterImageHttp
} from '../search/character-http'
import { createCharacterIdentifier } from '../search/identify'
import { createPortraitMatcher, type PortraitMatchPolicy } from '../search/portrait-match'
import { createPortraitEdgeMatcher, type PortraitEdgeMatchPolicy } from '../search/portrait-edges'
import { createStayImageSource } from '../search/stay-images'
import type { SearchRuntime } from '../search/request'
import { registerManualSearchIpc } from '../search/manual-ipc'
import { findSelectedSource, isCaptureRequestAllowed } from './capture-policy'

let captureWindow: BrowserWindow | null = null
let documentUrl: string | null = null
let windowGeneration = 0
let sourceSelectionGeneration = 0
let selectedSourceId: string | null = null
let selectingSource = false
let search: CaptureSearchLifetime | undefined
let manualSearch: ReturnType<typeof registerManualSearchIpc> | undefined
let mediaPermissionCaptureId: string | null = null

function consumeCaptureMediaPermission(contents: WebContents, requestingUrl: string): boolean {
  const binding = search?.current
  if (binding == null || !isCurrentSearch(binding)) {
    return false
  }
  const frame = currentMainFrame()
  if (contents !== captureWindow?.webContents) {
    return false
  }

  if (requestingUrl !== documentUrl) {
    return false
  }

  if (frame?.detached !== false) {
    return false
  }

  if (mediaPermissionCaptureId === binding.captureId) {
    return false
  }
  // Start 수명당 한 번만 허용한다. API/source/gesture 증명이 되지는 않는다.
  mediaPermissionCaptureId = binding.captureId

  return true
}

async function getWindowSources(): Promise<Electron.DesktopCapturerSource[]> {
  return desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 0, height: 0 },
    fetchWindowIcons: false
  })
}

function clearSource(): void {
  mediaPermissionCaptureId = null
  selectedSourceId = null
  selectingSource = false
  sourceSelectionGeneration += 1
  search?.invalidate()
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

function registerCaptureIpc(
  configuration?: {
    apiOrigin: string
    fetch?: typeof fetch
    clock: AuthClock
    portraitMatchPolicy?: PortraitMatchPolicy
    portraitEdgeMatchPolicy?: PortraitEdgeMatchPolicy
  },
  details?: { openSelected: typeof openSelectedCharacterDetail }
): () => void {
  let runtime: SearchRuntime | undefined
  if (configuration != null) {
    if (
      configuration.portraitMatchPolicy !== undefined &&
      configuration.portraitEdgeMatchPolicy !== undefined
    ) {
      throw new TypeError('Only one portrait comparison policy can be configured')
    }
    runtime = { http: createSearchHttp(configuration), clock: configuration.clock }
    if (configuration.portraitEdgeMatchPolicy !== undefined) {
      const appearance = createCharacterAppearanceHttp(configuration)
      const image = createStayImageSource({ appearance, fetch: configuration.fetch })
      runtime.identify = createCharacterIdentifier({
        candidates: createCharacterCandidatesHttp(configuration),
        image,
        details: createCharacterDetailsHttp(configuration),
        matchesPortrait: createPortraitEdgeMatcher(configuration.portraitEdgeMatchPolicy)
      })
    } else if (configuration.portraitMatchPolicy !== undefined) {
      runtime.identify = createCharacterIdentifier({
        candidates: createCharacterCandidatesHttp(configuration),
        image: createCharacterImageHttp(configuration),
        details: createCharacterDetailsHttp(configuration),
        matchesPortrait: createPortraitMatcher(configuration.portraitMatchPolicy)
      })
    }
  }
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
  manualSearch?.invalidate()
  const manual = registerManualSearchIpc({
    runtime,
    requireSender: requireSearchSender,
    windowGeneration: () => windowGeneration,
    isCurrentDocument: (generation) =>
      generation === windowGeneration && isTrustedFrame(captureWindow, currentMainFrame()),
    publish: (snapshot) => {
      if (isTrustedFrame(captureWindow, currentMainFrame())) {
        captureWindow!.webContents.send('manualSearchChanged', snapshot)
      }
    }
  })
  manualSearch = manual
  search = lifetime
  clearSource()
  addHandler('openCharacterDetails', async (event, ...args) => {
    requireSearchSender(event)
    const reference = parseCharacterSelection(args)
    const owner = captureWindow
    if (
      reference === null ||
      owner === null ||
      details === undefined ||
      event.senderFrame?.detached !== false
    ) {
      return { ok: false }
    }
    const selected = lifetime.selection(reference)
    if (selected === null) {
      return { ok: false }
    }
    const isCurrent = (): boolean => {
      try {
        requireSearchSender(event)

        return (
          captureWindow === owner &&
          event.senderFrame?.detached === false &&
          lifetime.selection(reference) === selected
        )
      } catch {
        return false
      }
    }
    try {
      const opened = await details.openSelected(owner, selected, isCurrent)
      const ok = opened && isCurrent()

      return { ok }
    } catch {
      return { ok: false }
    }
  })
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
      selectedSourceId = source.id

      return { id: source.id, name: source.name }
    } finally {
      const isLatestSelection = selectionGeneration === sourceSelectionGeneration
      if (isLatestSelection) {
        selectingSource = false
      }
    }
  })

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

    const isClear = control.action === SEARCH_ACTIONS.CLEAR
    if (isClear) {
      return lifetime.clear(control)
    }
    const isRetry = control.action === SEARCH_ACTIONS.RETRY
    if (isRetry) {
      return lifetime.retry(control)
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

  addHandler('notifyStableNicknameDetected', (event, ...args) => {
    requireSearchSender(event)
    const observation = parseSearchObservation(args)
    const hasValidObservation = observation != null
    if (!hasValidObservation) {
      return lifetime.result(SEARCH_COMMAND_ERRORS.INVALID_SEARCH_COMMAND)
    }

    return lifetime.observe(observation)
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
    clearSource()
    ipcMain.removeHandler('listCaptureSources')
    ipcMain.removeHandler('selectCaptureSource')
    ipcMain.removeHandler('notifyStableNicknameDetected')
    ipcMain.removeHandler('notifyOcrCandidatesDetected')
    ipcMain.removeHandler('controlCharacterSearch')
    ipcMain.removeHandler('openCharacterDetails')
  }
}

function registerCaptureWindow(window: BrowserWindow, rendererDocumentUrl: string): void {
  captureWindow = window
  documentUrl = rendererDocumentUrl
  windowGeneration += 1
  clearSource()
  manualSearch?.invalidate()
  registerDisplayMediaHandler(window)

  window.webContents.on('did-start-navigation', (_event, _url, _isInPlace, isMainFrame) => {
    const isCurrentWindow = captureWindow === window
    const shouldInvalidate = isCurrentWindow && isMainFrame
    if (!shouldInvalidate) {
      return
    }
    windowGeneration += 1
    clearSource()
    manualSearch?.invalidate()
  })
  window.webContents.on('destroyed', () => {
    const isCurrentWindow = captureWindow === window
    if (!isCurrentWindow) {
      return
    }
    windowGeneration += 1
    clearSource()
    manualSearch?.invalidate()
  })
  window.webContents.on('render-process-gone', () => {
    const isCurrentWindow = captureWindow === window
    if (!isCurrentWindow) {
      return
    }
    windowGeneration += 1
    clearSource()
    manualSearch?.invalidate()
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
    manualSearch?.invalidate()
  })
}

function deliverMediaResult(
  callback: (streams: Electron.Streams) => void,
  streams: Electron.Streams | null
): void {
  // Electron 39.8.10 native는 null을 CAPTURE_FAILURE로 받지만 공개 Streams type에는 빠져 있다.
  const nativeCallback = callback as (result: Electron.Streams | null) => void
  try {
    nativeCallback(streams)
  } catch {
    // Native once callback은 throw 전에 소비될 수 있으므로 재호출하지 않는다.
  }
}

function registerDisplayMediaHandler(window: BrowserWindow): void {
  window.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    const startedWindowGeneration = windowGeneration
    const selectionGeneration = sourceSelectionGeneration
    const sourceId = selectedSourceId
    const binding = search?.current
    const hasSource = sourceId != null
    const isTrusted = isTrustedFrame(window, request.frame)
    const isRequestAllowed = isCaptureRequestAllowed({
      hasSelectedSource: hasSource,
      isMainFrame: isTrusted,
      videoRequested: request.videoRequested,
      audioRequested: request.audioRequested,
      userGesture: request.userGesture
    })
    const hasCapture = binding != null
    if (!hasCapture) {
      deliverMediaResult(callback, null)

      return
    }

    const hasSameWindow = binding.windowGeneration === startedWindowGeneration
    const hasSameSource = binding.sourceGeneration === selectionGeneration
    const hasCurrentCapture = hasSameWindow && hasSameSource
    const isAllowed = hasSource && isRequestAllowed && hasCurrentCapture
    if (!isAllowed) {
      deliverMediaResult(callback, null)

      return
    }
    const captureId = binding.captureId
    void getWindowSources()
      .then((sources) => {
        const isCurrent = isCurrentCapture(startedWindowGeneration)
        const isStillTrusted = isTrustedFrame(window, request.frame)
        const hasSameSelection = selectionGeneration === sourceSelectionGeneration
        const hasSameCapture = search?.current?.captureId === binding?.captureId
        const canAllow = isCurrent && isStillTrusted && hasSameSelection && hasSameCapture
        const source = canAllow ? findSelectedSource(sources, sourceId) : null
        const hasSource = source != null
        if (!hasSource) {
          search?.end(captureId)
        }
        deliverMediaResult(callback, hasSource ? { video: source } : null)
      })
      .catch(() => {
        search?.end(captureId)
        deliverMediaResult(callback, null)
      })
  })
}

export { registerCaptureIpc, registerCaptureWindow, consumeCaptureMediaPermission }

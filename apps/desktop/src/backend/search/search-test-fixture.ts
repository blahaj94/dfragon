import { EventEmitter } from 'node:events'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { afterEach, expect, vi } from 'vitest'
import { FakeMonotonicClock } from '../lib/fake-monotonic-clock'
import { registerCaptureIpc, registerCaptureWindow } from '../capture/ipc-handler'
import type { SearchSnapshot } from '../../preload/common/types/search'
import type { CharacterDetails } from '../../preload/common/types/character'
import { characterImageUrl } from '../../preload/common/search/character-summary'
import type { CharacterSelectionPolicy } from './identify'
import type { PortraitColorPolicy } from './portrait-color'
import { INITIAL_PORTRAIT_COLOR_POLICY } from './portrait-policy'

vi.mock('../capture/native-frame', () => ({
  bindWindowFrame: () => () => ({ kind: 'unsupported' })
}))

const electron = vi.hoisted(() => {
  const getSources = vi.fn()
  const handle = vi.fn()
  const removeHandler = vi.fn()

  return { getSources, handle, removeHandler }
})
vi.mock('electron', () => ({
  desktopCapturer: { getSources: electron.getSources },
  ipcMain: { handle: electron.handle, removeHandler: electron.removeHandler }
}))

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
const disposeFixtures: Array<() => void> = []
const source = { id: 'window:search-fixture', name: 'Synthetic search window' }
const rendererUrl = 'file:///search-fixture/index.html'

export const API_ORIGIN = 'https://api.example.test'

export const candidate = {
  characterId: 'synthetic-character',
  characterName: '가나',
  serverId: 'cain',
  serverName: '카인',
  fame: 0
}

export const candidateResponse = { ...candidate, imageUrl: characterImageUrl(candidate) }

const candidateDetailsPath = `/characters/${candidate.serverId}/${candidate.characterId}`

function candidateDetails(): CharacterDetails {
  const metadata = {
    revision: 1,
    contentUpdatedAt: '2026-10-07T00:00:00.000Z',
    lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z'
  }

  return {
    character: { ...candidate, level: 115 },
    status: { status: [], buff: null },
    equipment: { equipment: [], setItemInfo: [] },
    avatar: null,
    creature: null,
    oath: null,
    mistAssimilation: null,
    skillStyle: null,
    buff: { equipment: null, avatar: null, creature: null },
    sections: {
      basic: metadata,
      status: metadata,
      equipment: metadata,
      avatar: metadata,
      creature: metadata,
      oath: metadata,
      mist_assimilation: metadata,
      skill_style: metadata,
      buff_equipment: metadata,
      buff_avatar: metadata,
      buff_creature: metadata
    },
    freshness: {
      lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z',
      expiresAt: '2026-10-07T00:05:00.000Z'
    }
  }
}

export function requestPaths(fetchSearch: ReturnType<typeof vi.fn<typeof fetch>>): string[] {
  return fetchSearch.mock.calls.map((args) => new URL(new Request(...args).url).pathname)
}

export function jsonResponse({
  body,
  status = 200,
  headers = {}
}: {
  body: unknown
  status?: number
  headers?: Record<string, string>
}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  })
}

export async function createSearchFixture(
  searchKind: 'capture' | 'manual' | 'raid' = 'capture',
  portraitColorPolicy: PortraitColorPolicy &
    CharacterSelectionPolicy = INITIAL_PORTRAIT_COLOR_POLICY
): Promise<{
  event: IpcMainInvokeEvent
  getSources: typeof electron.getSources
  clock: FakeMonotonicClock
  fetchSearch: ReturnType<typeof vi.fn<typeof fetch>>
  captureId: string
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  startSearch: (input: {
    slot: number
    observationRevision: number
    nickname: string
  }) => Promise<unknown>
  read: () => Promise<SearchSnapshot>
  published: ReturnType<typeof vi.fn>
  documentEvents: EventEmitter
  replaceDocument: () => void
}> {
  electron.handle.mockClear()
  electron.getSources.mockClear()
  electron.getSources.mockResolvedValue([source])
  const clock = new FakeMonotonicClock()
  // 따로 정하지 않은 요청은 후보 0명으로 답하고, 고정 후보의 상세 조회에는 그 상세를 돌려준다.
  const fetchSearch = vi.fn<typeof fetch>().mockImplementation(async (...args) => {
    const path = new URL(new Request(...args).url).pathname
    if (path === candidateDetailsPath) {
      return jsonResponse({ body: candidateDetails() })
    }

    return jsonResponse({ body: { rows: [] } })
  })
  const frame = { url: rendererUrl, detached: false, isDestroyed: () => false }
  const published = vi.fn()
  const documentEvents = new EventEmitter()
  const contents = {
    mainFrame: frame,
    isDestroyed: () => false,
    on: documentEvents.on.bind(documentEvents),
    send: published,
    session: { setDisplayMediaRequestHandler: vi.fn() }
  }
  const window = { webContents: contents, isDestroyed: () => false, on: vi.fn() }
  // Main 설정과 외부 fetch만 제어하며 실제 core와 capture handler를 사용한다.
  const dispose = registerCaptureIpc({
    apiOrigin: API_ORIGIN,
    fetch: fetchSearch,
    clock,
    portraitColorPolicy,
    // 점수 엔진 submodule이 없는 빌드처럼 엔진이 점수를 내지 않는다.
    score: () => null
  })
  disposeFixtures.push(dispose)
  registerCaptureWindow(window as unknown as BrowserWindow, rendererUrl)
  const handlers = new Map<string, Handler>()
  for (const [channel, handler] of electron.handle.mock.calls) {
    handlers.set(channel, handler)
  }
  const event = { sender: contents, senderFrame: frame } as unknown as IpcMainInvokeEvent
  const invoke = async (channel: string, ...args: unknown[]): Promise<unknown> => {
    const handler = handlers.get(channel)
    expect(handler, `등록된 ${channel} IPC`).toBeTypeOf('function')
    const hasHandler = handler != null
    if (!hasHandler) {
      throw new Error('Expected search IPC handler')
    }

    return handler(event, ...args)
  }
  const controlChannel = {
    capture: 'controlCharacterSearch',
    manual: 'controlManualSearch',
    raid: 'controlRaidSearch'
  }[searchKind]
  const read = async (): Promise<SearchSnapshot> => {
    const result = await invoke(controlChannel, { action: 'read' })
    expect(result).toMatchObject({ ok: true, snapshot: expect.any(Object) })

    return (result as { snapshot: SearchSnapshot }).snapshot
  }

  if (searchKind === 'capture') {
    await invoke('selectCaptureSource', source.id)
  }
  await invoke(controlChannel, {
    action: 'begin'
  })
  const begun = await read()
  expect(begun.captureId).toEqual(expect.any(String))
  const captureId = begun.captureId as string
  const startSearch = (input: {
    slot: number
    observationRevision: number
    nickname: string
  }): Promise<unknown> => {
    // 앱의 파티 캡처는 OCR 후보 통지를, 직접 조회와 공대 카드는 서버를 고른 조회를 보낸다.
    if (searchKind === 'capture') {
      return invoke('notifyOcrCandidatesDetected', {
        captureId,
        ...input,
        candidateNicknames: [input.nickname],
        portrait: null
      })
    }

    return invoke(controlChannel, { action: 'lookup', captureId, ...input, serverId: 'cain' })
  }

  const replaceDocument = (): void => {
    registerCaptureWindow(window as unknown as BrowserWindow, rendererUrl)
  }

  return {
    event,
    getSources: electron.getSources,
    clock,
    fetchSearch,
    captureId,
    invoke,
    startSearch,
    read,
    published,
    documentEvents,
    replaceDocument
  }
}

afterEach(() => {
  for (const dispose of disposeFixtures.splice(0)) {
    dispose()
  }
})

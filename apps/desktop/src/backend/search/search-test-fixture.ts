import { EventEmitter } from 'node:events'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { afterEach, expect, vi } from 'vitest'
import { FakeMonotonicClock } from '../lib/fake-monotonic-clock'
import { registerCaptureIpc, registerCaptureWindow } from '../capture/ipc-handler'
import type { SearchSnapshot } from '../../preload/common/types/search'
import type { CharacterSelectionPolicy } from './identify'
import type { PortraitColorPolicy } from './portrait-color'

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
  portraitColorPolicy?: PortraitColorPolicy & CharacterSelectionPolicy
): Promise<{
  event: IpcMainInvokeEvent
  getSources: typeof electron.getSources
  clock: FakeMonotonicClock
  fetchSearch: ReturnType<typeof vi.fn<typeof fetch>>
  captureId: string
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  observe: (input: {
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
  const fetchSearch = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => jsonResponse({ body: { rows: [] } }))
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
    portraitColorPolicy
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
  const observationChannel =
    searchKind === 'manual' ? 'notifyManualNickname' : 'notifyStableNicknameDetected'
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
  const observe = (input: {
    slot: number
    observationRevision: number
    nickname: string
  }): Promise<unknown> => {
    if (searchKind === 'raid') {
      return invoke(controlChannel, { action: 'lookup', captureId, ...input, serverId: 'cain' })
    }

    return invoke(observationChannel, { captureId, ...input })
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
    observe,
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

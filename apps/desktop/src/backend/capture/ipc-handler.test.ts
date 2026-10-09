import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createAuthCoordinator } from '../auth/coordinator'
import {
  createAuthHarness,
  deferred,
  REFRESH_0,
  CODE,
  RETURN_TARGET
} from '../auth/auth-test-fixtures'
import { registerCaptureIpc, registerCaptureWindow, collectCurrentCapture } from './ipc-handler'
import type { WindowFrameResult } from '../../preload/common/types/capture'
import type { OcrCollection } from '../ocr-collection/collection'

const nativeFrame = vi.hoisted(() => {
  const read = vi.fn<() => Promise<WindowFrameResult>>()
  const bind = vi.fn(() => read)

  return { read, bind }
})
vi.mock('./native-frame', () => ({ bindWindowFrame: nativeFrame.bind }))

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

const rendererUrl = 'file:///fixture/index.html'
const sources = [{ id: 'window:fixture', name: 'Synthetic capture window' }]
const disposeFixtures = new Set<() => void>()
type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
type MediaHandler = (
  request: Electron.DisplayMediaRequestHandlerHandlerRequest,
  callback: (result: unknown) => void
) => void

async function setup(
  signedIn = true,
  collection?: OcrCollection
): Promise<{
  auth: ReturnType<typeof createAuthCoordinator>
  harness: ReturnType<typeof createAuthHarness>
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  event: IpcMainInvokeEvent
  documentEvents: EventEmitter
  published: ReturnType<typeof vi.fn>
  dispose: () => void
  mainFrame: { url: string; detached: boolean; isDestroyed: () => boolean }
  dispatchMedia: (callback: (result: unknown) => void) => void
}> {
  const harness = createAuthHarness()
  if (signedIn) {
    harness.store.inspection = { status: 'ready', refreshToken: REFRESH_0 }
  }
  const auth = createAuthCoordinator(harness.dependencies)
  await auth.start()
  harness.http.refresh.mockClear()
  let mediaHandler: MediaHandler | undefined
  const documentEvents = new EventEmitter()
  const windowEvents = new EventEmitter()
  const published = vi.fn()
  const mainFrame = { url: rendererUrl, detached: false, isDestroyed: () => false }
  const webContents = {
    mainFrame,
    on: documentEvents.on.bind(documentEvents),
    send: published,
    isDestroyed: () => false,
    session: {
      setDisplayMediaRequestHandler: (handler: MediaHandler) => {
        mediaHandler = handler
      }
    }
  }
  const window = { webContents, isDestroyed: () => false, on: windowEvents.on.bind(windowEvents) }
  const disposeIpc = registerCaptureIpc(undefined, undefined, collection)
  disposeFixtures.add(disposeIpc)
  registerCaptureWindow(window as unknown as BrowserWindow, rendererUrl)
  const handlers = new Map<string, Handler>()
  for (const [channel, handler] of electron.handle.mock.calls) {
    handlers.set(channel, handler)
  }
  const event = { sender: webContents, senderFrame: mainFrame } as unknown as IpcMainInvokeEvent
  const invoke = (channel: string, ...args: unknown[]): Promise<unknown> => {
    const handler = handlers.get(channel)
    expect(handler, `등록된 ${channel} IPC가 요청을 처리해야 한다`).toBeTypeOf('function')
    const hasHandler = handler != null
    if (!hasHandler) {
      throw new Error('Capture handler was not registered')
    }

    return Promise.resolve().then(() => handler(event, ...args))
  }
  const dispatchMedia = (callback: (result: unknown) => void): void => {
    const request = {
      frame: mainFrame,
      videoRequested: true,
      audioRequested: false,
      userGesture: true
    }
    mediaHandler?.(request as Electron.DisplayMediaRequestHandlerHandlerRequest, callback)
  }

  const dispose = (): void => {
    disposeFixtures.delete(disposeIpc)
    disposeIpc()
  }

  return {
    auth,
    harness,
    invoke,
    event,
    mainFrame,
    dispatchMedia,
    documentEvents,
    published,
    dispose
  }
}

async function beginCapture(fixture: Awaited<ReturnType<typeof setup>>): Promise<void> {
  const result = await fixture.invoke('controlCharacterSearch', {
    action: 'begin'
  })

  expect(result).toMatchObject({ ok: true, snapshot: { captureId: expect.any(String) } })
}

beforeEach(() => {
  vi.clearAllMocks()
  electron.getSources.mockResolvedValue(sources)
})
afterEach(() => {
  for (const dispose of disposeFixtures) {
    dispose()
  }
  disposeFixtures.clear()
  vi.restoreAllMocks()
})

describe('capture main document and source boundary', () => {
  it.each([
    ['목록의 추가 인자', 'listCaptureSources', [true], 'Capture source access denied'],
    [
      '선택의 추가 인자',
      'selectCaptureSource',
      [sources[0].id, null],
      'Capture source selection denied'
    ],
    ['중지의 추가 인자', 'selectCaptureSource', ['', true], 'Capture source selection denied']
  ] as const)(
    '%s는 열거하거나 기존 캡처를 끝내기 전에 거절한다',
    async (_name, channel, args, message) => {
      const fixture = await setup(false)
      const image = { width: 1, height: 1, rgba: new Uint8Array([1, 2, 3, 255]) }
      await fixture.invoke('selectCaptureSource', sources[0].id)
      await beginCapture(fixture)
      const before = (await fixture.invoke('controlCharacterSearch', { action: 'read' })) as {
        snapshot: { captureId: string }
      }
      electron.getSources.mockClear()
      fixture.published.mockClear()

      await expect(fixture.invoke(channel, ...args)).rejects.toThrow(message)

      expect(await fixture.invoke('controlCharacterSearch', { action: 'read' })).toEqual(before)
      expect(electron.getSources).not.toHaveBeenCalled()
      expect(fixture.published).not.toHaveBeenCalled()
      nativeFrame.read.mockResolvedValueOnce({ kind: 'frame', image })
      await expect(fixture.invoke('readCaptureFrame', before.snapshot.captureId)).resolves.toEqual({
        kind: 'frame',
        image
      })
    }
  )

  it('나중에 끝난 이전 source 선택은 새 선택과 시작한 캡처를 덮지 않는다', async () => {
    const fixture = await setup(false)
    const nextSource = { id: 'window:second-fixture', name: 'Second synthetic capture window' }
    const pending = deferred<typeof sources>()
    electron.getSources
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue([sources[0], nextSource])
    const firstSelection = fixture.invoke('selectCaptureSource', sources[0].id)
    await vi.waitFor(() => expect(electron.getSources).toHaveBeenCalledTimes(1))
    expect(await fixture.invoke('selectCaptureSource', nextSource.id)).toEqual(nextSource)
    await beginCapture(fixture)
    const current = await fixture.invoke('controlCharacterSearch', { action: 'read' })

    pending.resolve(sources)

    expect(await firstSelection).toBeNull()
    expect(await fixture.invoke('controlCharacterSearch', { action: 'read' })).toEqual(current)
    expect(nativeFrame.bind).toHaveBeenCalledExactlyOnceWith(nextSource.id)
  })

  it('subframe navigation은 캡처를 유지하고 main document navigation은 수명을 끝낸다', async () => {
    const fixture = await setup(false)
    const image = { width: 1, height: 1, rgba: new Uint8Array([1, 2, 3, 255]) }
    nativeFrame.read.mockResolvedValueOnce({ kind: 'frame', image })
    await fixture.invoke('selectCaptureSource', sources[0].id)
    await beginCapture(fixture)
    const before = (await fixture.invoke('controlCharacterSearch', { action: 'read' })) as {
      snapshot: { captureId: string }
    }

    fixture.documentEvents.emit(
      'did-start-navigation',
      {},
      'file:///embedded/index.html',
      false,
      false
    )

    expect(await fixture.invoke('controlCharacterSearch', { action: 'read' })).toEqual(before)
    // snapshot은 창 세대만 바뀌어 낡은 binding을 드러내지 않으므로 같은 캡처로 프레임을 계속 읽을 수 있는지 확인한다.
    await expect(fixture.invoke('readCaptureFrame', before.snapshot.captureId)).resolves.toEqual({
      kind: 'frame',
      image
    })
    fixture.documentEvents.emit('did-start-navigation', {}, rendererUrl, false, true)
    expect(await fixture.invoke('controlCharacterSearch', { action: 'read' })).toMatchObject({
      ok: true,
      snapshot: { captureId: null }
    })
    await expect(fixture.invoke('readCaptureFrame', before.snapshot.captureId)).rejects.toThrow(
      'CAPTURE_NOT_ALLOWED'
    )
  })

  it('IPC 해제는 캡처, 직접 검색과 캡처 프레임 읽기를 정리하고 모든 전용 handler를 제거한다', async () => {
    const fixture = await setup(false)
    await fixture.invoke('selectCaptureSource', sources[0].id)
    await beginCapture(fixture)
    const captured = (await fixture.invoke('controlCharacterSearch', { action: 'read' })) as {
      snapshot: { captureId: string }
    }
    await fixture.invoke('controlManualSearch', { action: 'begin' })
    fixture.published.mockClear()

    fixture.dispose()

    expect(electron.removeHandler.mock.calls.map(([channel]) => channel).sort()).toEqual([
      'collectOcrSample',
      'controlCharacterSearch',
      'controlManualSearch',
      'listCaptureSources',
      'notifyManualNickname',
      'notifyOcrCandidatesDetected',
      'notifyStableNicknameDetected',
      'openCharacterDetails',
      'readCaptureFrame',
      'selectCaptureSource'
    ])
    expect(
      fixture.published.mock.calls
        .map(([channel, snapshot]) => [channel, snapshot.captureId])
        .sort()
    ).toEqual([
      ['characterSearchChanged', null],
      ['manualSearchChanged', null]
    ])
    // 해제 전에 받은 handler 참조로 호출해도 정리된 캡처의 프레임은 읽지 않는다.
    await expect(fixture.invoke('readCaptureFrame', captured.snapshot.captureId)).rejects.toThrow(
      'CAPTURE_NOT_ALLOWED'
    )
    expect(nativeFrame.read).not.toHaveBeenCalled()
  })

  it('검색 read는 capture를 시작하거나 인증 HTTP를 실행하지 않는다', async () => {
    const fixture = await setup()

    const result = await fixture.invoke('controlCharacterSearch', { action: 'read' })

    expect(result).toMatchObject({ ok: true, snapshot: { captureId: null } })
    expect(electron.getSources).not.toHaveBeenCalled()
    expect(fixture.harness.http.refresh).not.toHaveBeenCalled()
  })

  it('선택 source로 begin하고 이전 end가 새 capture를 끝내지 않는다', async () => {
    const fixture = await setup()
    await fixture.invoke('selectCaptureSource', sources[0].id)
    const begin = {
      action: 'begin'
    }

    const first = await fixture.invoke('controlCharacterSearch', begin)

    expect(first).toMatchObject({ ok: true, snapshot: { captureId: expect.any(String) } })
    const firstCaptureId = (first as { snapshot: { captureId: string } }).snapshot.captureId
    expect(firstCaptureId).toMatch(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i)
    expect(await fixture.invoke('controlCharacterSearch', begin)).toMatchObject({
      ok: false,
      error: { code: 'SEARCH_BUSY' }
    })

    const ended = await fixture.invoke('controlCharacterSearch', {
      action: 'end',
      captureId: firstCaptureId
    })

    expect(ended).toMatchObject({ ok: true, snapshot: { captureId: null } })
    const second = await fixture.invoke('controlCharacterSearch', begin)
    expect(second).toMatchObject({ ok: true, snapshot: { captureId: expect.any(String) } })
    const secondCaptureId = (second as { snapshot: { captureId: string } }).snapshot.captureId
    expect(secondCaptureId).not.toBe(firstCaptureId)
    expect(
      await fixture.invoke('controlCharacterSearch', { action: 'end', captureId: firstCaptureId })
    ).toMatchObject({ ok: true, snapshot: { captureId: secondCaptureId } })
  })

  it.each(['missing-source', 'selecting-source'])(
    'begin은 %s 상태를 승인된 오류로 거절한다',
    async (condition) => {
      const fixture = await setup()
      const isSelectingSource = condition === 'selecting-source'
      const pending = deferred<typeof sources>()
      let selection: Promise<unknown> | undefined
      if (isSelectingSource) {
        electron.getSources.mockReturnValueOnce(pending.promise)
        selection = fixture.invoke('selectCaptureSource', sources[0].id)
        await Promise.resolve()
      }
      const expectedCode = isSelectingSource ? 'SEARCH_BUSY' : 'SEARCH_NOT_ALLOWED'

      try {
        const result = await fixture.invoke('controlCharacterSearch', {
          action: 'begin'
        })

        expect(result).toMatchObject({
          ok: false,
          error: { code: expectedCode },
          snapshot: { captureId: null }
        })
      } finally {
        pending.resolve(sources)
        await selection
      }
    }
  )

  it.each(['source-clear'])(
    '%s는 main capture를 지우고 종료된 ID의 cleanup을 허용한다',
    async () => {
      const fixture = await setup()
      await fixture.invoke('selectCaptureSource', sources[0].id)
      const begun = await fixture.invoke('controlCharacterSearch', {
        action: 'begin'
      })
      expect(begun).toMatchObject({ ok: true, snapshot: { captureId: expect.any(String) } })
      const captureId = (begun as { snapshot: { captureId: string } }).snapshot.captureId
      await fixture.invoke('selectCaptureSource', '')

      expect(await fixture.invoke('controlCharacterSearch', { action: 'read' })).toMatchObject({
        ok: true,
        snapshot: { captureId: null }
      })
      expect(
        await fixture.invoke('controlCharacterSearch', { action: 'end', captureId })
      ).toMatchObject({ ok: true, snapshot: { captureId: null } })
    }
  )

  it.each([
    { name: '기존 shape', args: [{ slot: 0, nickname: '가나' }] },
    {
      name: '알 수 없는 field',
      args: [
        {
          captureId: '00000000-0000-4000-8000-000000000001',
          slot: 0,
          observationRevision: 1,
          nickname: '가나',
          unexpected: true
        }
      ]
    },
    {
      name: '추가 인자',
      args: [
        {
          captureId: '00000000-0000-4000-8000-000000000001',
          slot: 0,
          observationRevision: 1,
          nickname: '가나'
        },
        null
      ]
    }
  ])('관측의 $name는 정제된 입력 실패와 빈 현재 snapshot으로 응답한다', async ({ args }) => {
    const fixture = await setup()

    const result = await fixture.invoke('notifyStableNicknameDetected', ...args)

    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_SEARCH_COMMAND' },
      snapshot: {
        runId: expect.any(String),
        revision: expect.any(Number),
        captureId: null,
        slots: [0, 1, 2, 3].map((slot) => ({
          slot,
          observationRevision: 0,
          requestId: null,
          nickname: null,
          state: 'idle',
          rows: [],
          error: null
        }))
      }
    })
    expect(fixture.harness.http.refresh).not.toHaveBeenCalled()
  })

  it('signedOut에서도 source 열거, 선택, begin과 cleanup을 허용한다', async () => {
    const fixture = await setup(false)
    await expect(fixture.invoke('listCaptureSources')).resolves.toEqual(sources)
    await expect(fixture.invoke('selectCaptureSource', sources[0].id)).resolves.toEqual(sources[0])
    await beginCapture(fixture)
    await expect(fixture.invoke('selectCaptureSource', '')).resolves.toBeNull()
    expect(await fixture.invoke('controlCharacterSearch', { action: 'read' })).toMatchObject({
      ok: true,
      snapshot: { captureId: null }
    })
  })

  it('검색 설정이 없어도 guest capture와 OCR 관측을 유지하고 검색 불가를 표시한다', async () => {
    const fixture = await setup(false)
    await fixture.invoke('selectCaptureSource', sources[0].id)
    await beginCapture(fixture)
    const current = (await fixture.invoke('controlCharacterSearch', { action: 'read' })) as {
      snapshot: { captureId: string }
    }
    const result = await fixture.invoke('notifyStableNicknameDetected', {
      captureId: current.snapshot.captureId,
      slot: 0,
      observationRevision: 1,
      nickname: '가나'
    })

    expect(result).toMatchObject({
      ok: true,
      snapshot: {
        captureId: current.snapshot.captureId,
        slots: [
          expect.objectContaining({
            nickname: '가나',
            state: 'failure',
            error: { code: 'NEOPLE_UNAVAILABLE', retryAfterSeconds: null }
          }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Object)
        ]
      }
    })
    expect(fixture.harness.http.refresh).not.toHaveBeenCalled()
  })

  it.each(['listCaptureSources', 'selectCaptureSource'])(
    '%s 완료 전 logout이어도 결과를 허용한다',
    async (channel) => {
      const fixture = await setup()
      const pending = deferred<typeof sources>()
      electron.getSources.mockReturnValue(pending.promise)
      const isSelection = channel === 'selectCaptureSource'
      const operation = fixture.invoke(channel, ...(isSelection ? [sources[0].id] : []))
      await Promise.resolve()
      await fixture.auth.logout()
      pending.resolve(sources)
      expect(await operation).toEqual(isSelection ? sources[0] : sources)
    }
  )

  it('source 열거는 logout과 재로그인의 영향을 받지 않는다', async () => {
    const fixture = await setup()
    const pending = deferred<typeof sources>()
    electron.getSources.mockReturnValue(pending.promise)
    const operation = fixture.invoke('listCaptureSources')
    await Promise.resolve()
    await fixture.auth.logout()
    await fixture.auth.beginLogin('passkey')
    await vi.waitFor(() => expect(fixture.auth.getSnapshot().phase).toBe('waitingBrowser'))
    await fixture.auth.handleReturnUrl(`${RETURN_TARGET}?code=${CODE}`)
    expect(fixture.auth.getSnapshot().phase).toBe('signedIn')
    pending.resolve(sources)
    expect(await operation).toEqual(sources)
  })

  it.each(['subframe', 'document'])(
    'trusted window라도 %s 변경 뒤 source 요청은 거절한다',
    async (kind) => {
      const fixture = await setup()
      const isSubframe = kind === 'subframe'
      if (isSubframe) {
        Object.assign(fixture.event, { senderFrame: { url: rendererUrl } })
      } else {
        fixture.mainFrame.url = `${rendererUrl}?unexpected`
      }
      await expect(fixture.invoke('listCaptureSources')).rejects.toThrow()
      expect(electron.getSources).not.toHaveBeenCalled()
    }
  )

  it.each(['listCaptureSources', 'selectCaptureSource'])(
    '%s 완료 전 document 변경이면 거절한다',
    async (channel) => {
      const fixture = await setup()
      const pending = deferred<typeof sources>()
      electron.getSources.mockReturnValue(pending.promise)
      const isSelection = channel === 'selectCaptureSource'
      const operation = fixture.invoke(channel, ...(isSelection ? [sources[0].id] : []))
      const rejection = expect(operation).rejects.toThrow()
      await Promise.resolve()
      fixture.mainFrame.url = 'about:blank'
      pending.resolve(sources)
      await rejection
    }
  )

  it('trusted renderer의 빈 선택도 subframe에서는 cleanup을 허용하지 않는다', async () => {
    const fixture = await setup(false)
    Object.assign(fixture.event, { senderFrame: { url: rendererUrl } })
    await expect(fixture.invoke('selectCaptureSource', '')).rejects.toThrow()
  })

  it('선택 뒤 logout은 main source와 캡처 프레임 읽기를 유지한다', async () => {
    const fixture = await setup()
    const image = { width: 1, height: 1, rgba: new Uint8Array([1, 2, 3, 255]) }
    await fixture.invoke('selectCaptureSource', sources[0].id)
    await beginCapture(fixture)
    const captured = (await fixture.invoke('controlCharacterSearch', { action: 'read' })) as {
      snapshot: { captureId: string }
    }
    await fixture.auth.logout()
    nativeFrame.read.mockResolvedValueOnce({ kind: 'frame', image })
    await expect(fixture.invoke('readCaptureFrame', captured.snapshot.captureId)).resolves.toEqual({
      kind: 'frame',
      image
    })
  })

  // Electron 44.7.0은 null을 예외 없는 거절로 처리한다. {}는 별도 TypeError도 낸다.
  it.each(['선택 없음', '선택 후 캡처 중'])(
    '창 등록의 display media 요청은 %s 상태에서도 native null로 한 번 거절한다',
    async (state) => {
      const fixture = await setup()
      const isCapturing = state === '선택 후 캡처 중'
      if (isCapturing) {
        await fixture.invoke('selectCaptureSource', sources[0].id)
        await beginCapture(fixture)
      }
      const callback = vi.fn()

      fixture.dispatchMedia(callback)

      expect(callback).toHaveBeenCalledExactlyOnceWith(null)
    }
  )

  it('창 등록의 display media callback이 소비 뒤 throw해도 handler 밖으로 던지거나 다시 호출하지 않는다', async () => {
    const fixture = await setup()
    const callback = vi.fn(() => {
      throw new Error('SYNTHETIC_CONSUMED_CALLBACK')
    })

    expect(() => fixture.dispatchMedia(callback)).not.toThrow()

    expect(callback).toHaveBeenCalledExactlyOnceWith(null)
  })

  it.each(['signedOut', 'logout'])(
    '%s에서도 capture ID가 없는 관측은 STALE_SEARCH로 거절한다',
    async (phase) => {
      const startsSignedIn = phase === 'logout'
      const fixture = await setup(startsSignedIn)
      vi.spyOn(console, 'info').mockImplementation(() => undefined)
      if (startsSignedIn) {
        await fixture.auth.logout()
      }
      await expect(
        fixture.invoke('notifyStableNicknameDetected', {
          captureId: '00000000-0000-4000-8000-000000000001',
          slot: 0,
          observationRevision: 1,
          nickname: '가나'
        })
      ).resolves.toMatchObject({
        ok: false,
        error: { code: 'STALE_SEARCH' },
        snapshot: { captureId: null }
      })
      expect(fixture.harness.http.refresh).not.toHaveBeenCalled()
    }
  )

  it.each(['notifyStableNicknameDetected', 'controlCharacterSearch'])(
    '%s의 untrusted sender는 snapshot 없는 SEARCH_NOT_ALLOWED rejection을 받는다',
    async (channel) => {
      const fixture = await setup()
      Object.assign(fixture.event, { sender: {} })
      const isObservation = channel === 'notifyStableNicknameDetected'
      const input = isObservation
        ? {
            captureId: '00000000-0000-4000-8000-000000000001',
            slot: 0,
            observationRevision: 1,
            nickname: '가나'
          }
        : { action: 'read' }

      await expect(fixture.invoke(channel, input)).rejects.toThrow(/^SEARCH_NOT_ALLOWED$/)
      expect(fixture.harness.http.refresh).not.toHaveBeenCalled()
      expect(electron.getSources).not.toHaveBeenCalled()
    }
  )

  it('capture 조회, 선택, begin은 HTTP refresh 없이 실행하고 raw OCR를 log하지 않는다', async () => {
    const fixture = await setup()
    fixture.harness.clock.elapseWithoutTimers(16 * 60 * 1000)
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    await fixture.invoke('listCaptureSources')
    await fixture.invoke('selectCaptureSource', sources[0].id)
    await beginCapture(fixture)
    await fixture.invoke('notifyStableNicknameDetected', { slot: 0, nickname: 'SYNTHETIC_CANARY' })
    expect(fixture.harness.http.refresh).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  })
})

describe('선택한 창의 네이티브 프레임 IPC', () => {
  it('활성 캡처에 결합된 창만 읽고 임의 창 식별자를 받지 않는다', async () => {
    const f = await setup(false)
    const image = { width: 1, height: 1, rgba: new Uint8Array([1, 2, 3, 255]) }
    nativeFrame.read.mockResolvedValue({ kind: 'frame', image })
    await f.invoke('selectCaptureSource', sources[0].id)
    const begun = (await f.invoke('controlCharacterSearch', { action: 'begin' })) as {
      snapshot: { captureId: string }
    }
    const captureId = begun.snapshot.captureId

    await expect(f.invoke('readCaptureFrame', captureId)).resolves.toEqual({ kind: 'frame', image })
    expect(nativeFrame.bind).toHaveBeenCalledWith(sources[0].id)
    expect(nativeFrame.read).toHaveBeenCalledExactlyOnceWith()
    await expect(f.invoke('readCaptureFrame', captureId, 'window:999:0')).rejects.toThrow(
      'CAPTURE_NOT_ALLOWED'
    )
    await expect(f.invoke('readCaptureFrame', 'stale')).rejects.toThrow('CAPTURE_NOT_ALLOWED')
    expect(nativeFrame.read).toHaveBeenCalledOnce()
  })

  it.each(['end', 'source', 'document'] as const)(
    '%s 뒤 늦은 픽셀 응답은 전달하지 않는다',
    async (change) => {
      const f = await setup(false)
      const pending = deferred<WindowFrameResult>()
      nativeFrame.read.mockReturnValueOnce(pending.promise)
      await f.invoke('selectCaptureSource', sources[0].id)
      const begun = (await f.invoke('controlCharacterSearch', { action: 'begin' })) as {
        snapshot: { captureId: string }
      }
      const captureId = begun.snapshot.captureId
      const response = f.invoke('readCaptureFrame', captureId)
      const rejected = expect(response).rejects.toThrow()
      await vi.waitFor(() => expect(nativeFrame.read).toHaveBeenCalledOnce())
      if (change === 'end') {
        await f.invoke('controlCharacterSearch', { action: 'end', captureId })
      } else if (change === 'source') {
        await f.invoke('selectCaptureSource', sources[0].id)
      } else {
        f.documentEvents.emit('did-start-navigation', {}, rendererUrl, false, true)
      }
      pending.resolve({ kind: 'frame', image: { width: 1, height: 1, rgba: new Uint8Array(4) } })
      await rejected
    }
  )

  it.each(['다른 문서', '파괴된 main frame'])(
    '%s에서는 네이티브 읽기를 시작하지 않는다',
    async (condition) => {
      const f = await setup(false)
      await f.invoke('selectCaptureSource', sources[0].id)
      const begun = (await f.invoke('controlCharacterSearch', { action: 'begin' })) as {
        snapshot: { captureId: string }
      }
      const isDestroyed = condition === '파괴된 main frame'
      if (isDestroyed) {
        f.mainFrame.isDestroyed = () => true
      } else {
        f.mainFrame.url = 'file:///other.html'
      }

      await expect(f.invoke('readCaptureFrame', begun.snapshot.captureId)).rejects.toThrow()
      expect(nativeFrame.read).not.toHaveBeenCalled()
    }
  )
})

describe('OCR 수집 프레임 권한', () => {
  const frameId = '10000000-0000-4000-8000-000000000002'
  const image = { width: 1, height: 1, rgba: new Uint8Array([1, 2, 3, 255]) }

  function collectionFixture(): { [K in keyof OcrCollection]: Mock<OcrCollection[K]> } {
    return {
      retain: vi.fn<OcrCollection['retain']>(() => frameId),
      collect: vi.fn<OcrCollection['collect']>(() => ({ status: 'queued' })),
      collectShortcut: vi.fn<OcrCollection['collectShortcut']>(() => ({ status: 'queued' })),
      clear: vi.fn<OcrCollection['clear']>(),
      dispose: vi.fn<OcrCollection['dispose']>()
    }
  }

  it('API 설정과 로그인 없이 현재 main 프레임을 보관하고 발급 참조만 수집기에 전달한다', async () => {
    const collection = collectionFixture()
    const f = await setup(false, collection)
    nativeFrame.read.mockResolvedValue({ kind: 'frame', image })
    await f.invoke('selectCaptureSource', sources[0].id)
    const begun = (await f.invoke('controlCharacterSearch', { action: 'begin' })) as {
      snapshot: { captureId: string }
    }
    const captureId = begun.snapshot.captureId
    await expect(f.invoke('readCaptureFrame', captureId)).resolves.toEqual({
      kind: 'frame',
      image,
      frameId
    })
    expect(collection.retain).toHaveBeenCalledExactlyOnceWith(captureId, image)
    const request = { captureId, frameId, slot: 1, prediction: null }
    await expect(f.invoke('collectOcrSample', request)).resolves.toEqual({ status: 'queued' })
    expect(collection.collect).toHaveBeenCalledExactlyOnceWith(request)
    await expect(f.invoke('collectOcrSample', { ...request, rgba: image.rgba })).resolves.toEqual({
      status: 'skipped'
    })
    await expect(f.invoke('collectOcrSample', { ...request, captureId: frameId })).resolves.toEqual(
      { status: 'skipped' }
    )
    expect(collection.collect).toHaveBeenCalledTimes(1)
    f.mainFrame.url = 'file:///other.html'
    await expect(f.invoke('collectOcrSample', request)).rejects.toThrow()
    expect(collection.collect).toHaveBeenCalledTimes(1)
  })

  it('단축키는 최신 프레임을 읽되 캡처 종료 후 늦은 응답은 업로드하지 않는다', async () => {
    const collection = collectionFixture()
    const f = await setup(false, collection)
    await f.invoke('selectCaptureSource', sources[0].id)
    const begun = (await f.invoke('controlCharacterSearch', { action: 'begin' })) as {
      snapshot: { captureId: string }
    }
    const captureId = begun.snapshot.captureId
    nativeFrame.read.mockResolvedValueOnce({ kind: 'frame', image })
    await expect(collectCurrentCapture()).resolves.toEqual({ status: 'queued' })
    expect(collection.collectShortcut).toHaveBeenCalledExactlyOnceWith(captureId, image)
    const pending = deferred<WindowFrameResult>()
    nativeFrame.read.mockReturnValueOnce(pending.promise)
    const result = collectCurrentCapture()
    collection.clear.mockClear()
    await f.invoke('controlCharacterSearch', { action: 'end', captureId })
    pending.resolve({ kind: 'frame', image })
    await expect(result).resolves.toEqual({ status: 'skipped' })
    expect(collection.collectShortcut).toHaveBeenCalledTimes(1)
    expect(collection.clear).toHaveBeenCalledOnce()
    f.dispose()
    expect(collection.dispose).toHaveBeenCalledOnce()
  })
})

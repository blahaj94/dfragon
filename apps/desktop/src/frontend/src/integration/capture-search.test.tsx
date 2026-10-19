import type { WindowFrameResult } from '@dfragon/desktop-contracts/types/capture'
// @vitest-environment jsdom
import { act } from 'react'
import { expect, it } from 'vitest'
import type { SearchCommandResult } from '@dfragon/desktop-contracts/types/search'
import { CAPTURE_ID, searchSnapshot } from '@dfragon/desktop-contracts/search/search-test-fixture'
import {
  authSnapshot,
  captureResources,
  createRendererFixture,
  media
} from '../testing/fixtures/search-renderer-test-fixture'

it('비로그인 Start는 검색 세션을 begin한 뒤 반환 captureId의 media와 OCR를 시작한다', async () => {
  const fixture = createRendererFixture()
  await fixture.emitAuth(authSnapshot({ signedIn: false }))
  await fixture.mount()
  media.crops.mockReturnValue([document.createElement('canvas'), null, null, null])
  await fixture.start()
  expect(fixture.search.controlCharacterSearch).toHaveBeenCalledWith({
    action: 'begin'
  })
  const beginOrder = fixture.search.controlCharacterSearch.mock.invocationCallOrder.at(-1)!
  expect(beginOrder).toBeLessThan(fixture.readCaptureFrame.mock.invocationCallOrder[0])
  expect(fixture.readCaptureFrame).toHaveBeenCalledOnce()
  expect(media.worker).toHaveBeenCalledOnce()
  expect(fixture.resources.worker.recognize).toHaveBeenCalledOnce()
  expect(fixture.capture.notifyStableNicknameDetected).toHaveBeenCalledExactlyOnceWith({
    captureId: CAPTURE_ID,
    slot: 0,
    observationRevision: 1,
    nickname: 'ALICE'
  })
})

it('begin 완료 전 Start 버튼은 비활성화하고 진행 중인 회차를 유지한다', async () => {
  const fixture = createRendererFixture()
  await fixture.mount()
  const begin = Promise.withResolvers<SearchCommandResult>()
  fixture.search.controlCharacterSearch.mockReturnValueOnce(begin.promise)
  await fixture.start()
  expect(fixture.search.controlCharacterSearch).toHaveBeenLastCalledWith({
    action: 'begin'
  })
  expect(fixture.button('캡처 시작').disabled).toBe(true)
  await fixture.click('캡처 시작')
  expect(
    fixture.search.controlCharacterSearch.mock.calls.filter(
      ([command]) => command.action === 'begin'
    )
  ).toHaveLength(1)
  expect(fixture.readCaptureFrame).not.toHaveBeenCalled()
  begin.resolve({ ok: true, snapshot: searchSnapshot() })
  await act(async () => undefined)
  expect(fixture.readCaptureFrame).toHaveBeenCalledOnce()
})

it.each(['캡처 중지', 'source', 'unmount'] as const)(
  '%s 뒤 늦은 begin 성공은 그 ID만 end하고 media를 시작하지 않는다',
  async (transition) => {
    const fixture = createRendererFixture()
    await fixture.mount()
    const begin = Promise.withResolvers<SearchCommandResult>()
    fixture.search.controlCharacterSearch.mockReturnValueOnce(begin.promise)
    await fixture.start()
    const isStop = transition === '캡처 중지'
    const isSource = transition === 'source'
    if (isStop) {
      await fixture.click('캡처 중지')
    } else if (isSource) {
      await fixture.select('next')
    } else {
      await fixture.unmount()
    }
    begin.resolve({ ok: true, snapshot: searchSnapshot() })
    await act(async () => undefined)
    expect(fixture.search.controlCharacterSearch).toHaveBeenCalledWith({
      action: 'end',
      captureId: CAPTURE_ID
    })
    expect(fixture.readCaptureFrame).not.toHaveBeenCalled()
    expect(media.worker).not.toHaveBeenCalled()
  }
)

it.each(['캡처 중지', 'source', 'unmount'] as const)(
  '%s는 진행 중인 OCR을 취소하고 현재 capture ID와 worker를 정리한다',
  async (transition) => {
    const fixture = createRendererFixture()
    const recognition =
      Promise.withResolvers<Awaited<ReturnType<typeof fixture.resources.worker.recognize>>>()
    media.crops.mockReturnValue([document.createElement('canvas'), null, null, null])
    fixture.resources.worker.recognize.mockReturnValueOnce(recognition.promise)
    media.worker.mockImplementationOnce(async (signal: AbortSignal) => {
      signal.addEventListener('abort', () => recognition.reject(signal.reason), { once: true })

      return fixture.resources.worker
    })
    await fixture.mount()
    await fixture.start()
    expect(fixture.resources.worker.recognize).toHaveBeenCalledOnce()
    expect(fixture.resources.worker.terminate).not.toHaveBeenCalled()
    const signal = media.worker.mock.calls[0][0] as AbortSignal
    expect(signal.aborted).toBe(false)
    if (transition === '캡처 중지') {
      await fixture.click('캡처 중지')
    } else if (transition === 'source') {
      await fixture.select('next')
    } else {
      await fixture.unmount()
    }
    expect(signal.aborted).toBe(true)
    expect(fixture.resources.worker.terminate).toHaveBeenCalledOnce()
    expect(fixture.search.controlCharacterSearch).toHaveBeenCalledWith({
      action: 'end',
      captureId: CAPTURE_ID
    })
    expect(fixture.capture.notifyStableNicknameDetected).not.toHaveBeenCalled()
    expect(fixture.container.textContent).not.toContain('ALICE')
  }
)

it.each(['media failed', 'OCR failed'] as const)(
  '%s는 현재 capture ID를 종료하고 생성한 worker를 정리한다',
  async (failure) => {
    const fixture = createRendererFixture()
    if (failure === 'media failed') {
      fixture.readCaptureFrame.mockRejectedValueOnce(new Error('Synthetic media failure'))
    } else {
      media.crops.mockReturnValue([document.createElement('canvas'), null, null, null])
      fixture.resources.worker.recognize.mockRejectedValueOnce(new Error('Synthetic OCR failure'))
    }
    await fixture.mount()
    await fixture.start()
    expect(fixture.search.controlCharacterSearch).toHaveBeenCalledWith({
      action: 'end',
      captureId: CAPTURE_ID
    })
    const createdWorkerCount = failure === 'OCR failed' ? 1 : 0
    expect(media.worker).toHaveBeenCalledTimes(createdWorkerCount)
    expect(fixture.resources.worker.terminate).toHaveBeenCalledTimes(createdWorkerCount)
    expect(fixture.capture.notifyStableNicknameDetected).not.toHaveBeenCalled()
    expect(fixture.container.textContent).not.toContain('ALICE')
  }
)

it('늦은 이전 begin은 새 capture를 end하거나 새 stream을 정리하지 않는다', async () => {
  const fixture = createRendererFixture()
  await fixture.mount()
  const first = Promise.withResolvers<SearchCommandResult>()
  fixture.search.controlCharacterSearch.mockReturnValueOnce(first.promise)
  await fixture.start()
  await fixture.click('캡처 중지')
  const nextId = '00000000-0000-4000-8000-000000000099'
  fixture.search.controlCharacterSearch.mockResolvedValueOnce({
    ok: true,
    snapshot: searchSnapshot({ captureId: nextId, revision: 2 })
  })
  await fixture.start()
  first.resolve({ ok: true, snapshot: searchSnapshot() })
  await act(async () => undefined)
  expect(fixture.search.controlCharacterSearch).toHaveBeenCalledWith({
    action: 'end',
    captureId: CAPTURE_ID
  })
  expect(fixture.search.controlCharacterSearch).not.toHaveBeenCalledWith({
    action: 'end',
    captureId: nextId
  })

  expect(fixture.readCaptureFrame).toHaveBeenCalledOnce()
})

it('새 capture의 늦은 이전 media 실패가 새 ID를 end하지 않는다', async () => {
  const fixture = createRendererFixture()
  const oldMedia = Promise.withResolvers<WindowFrameResult>()
  fixture.readCaptureFrame.mockReturnValueOnce(oldMedia.promise)
  await fixture.mount()
  await fixture.start()
  await fixture.click('캡처 중지')
  const next = captureResources()
  fixture.readCaptureFrame.mockResolvedValue(next.frame)
  media.worker.mockResolvedValue(next.worker)
  await fixture.start()
  const nextId = fixture.current().captureId
  await act(async () => oldMedia.reject(new Error('Synthetic old media failure')))
  expect(fixture.search.controlCharacterSearch).toHaveBeenCalledWith({
    action: 'end',
    captureId: CAPTURE_ID
  })
  expect(fixture.search.controlCharacterSearch).not.toHaveBeenCalledWith({
    action: 'end',
    captureId: nextId
  })

  expect(next.worker.terminate).toHaveBeenCalledOnce()
})

it('새 회차는 이전 capture를 종료하고 첫 관측 revision부터 시작한다', async () => {
  const fixture = createRendererFixture()
  await fixture.mount()
  media.crops.mockReturnValue([document.createElement('canvas'), null, null, null])
  await fixture.start()
  fixture.resources.worker.recognize.mockResolvedValue({
    data: { text: 'BOB', confidence: 1, candidates: [{ nickname: 'BOB', rank: 1, modelScore: 1 }] }
  })
  await fixture.click('캡처 시작')
  expect(fixture.search.controlCharacterSearch).toHaveBeenCalledWith({
    action: 'end',
    captureId: CAPTURE_ID
  })
  expect(fixture.current().captureId).not.toBe(CAPTURE_ID)
  expect(fixture.capture.notifyStableNicknameDetected).toHaveBeenLastCalledWith({
    captureId: fixture.current().captureId,
    slot: 0,
    observationRevision: 1,
    nickname: 'BOB'
  })
  expect(fixture.capture.notifyStableNicknameDetected).toHaveBeenCalledTimes(2)
  expect(fixture.readCaptureFrame).toHaveBeenCalledTimes(2)
})

it('로그인과 로그아웃은 진행 중 캡처와 표시된 검색 결과를 유지한다', async () => {
  const fixture = createRendererFixture()
  await fixture.emitAuth(authSnapshot({ signedIn: false }))
  await fixture.mount()
  media.crops.mockReturnValue([document.createElement('canvas'), null, null, null])
  await fixture.start()
  expect(fixture.container.textContent).toContain('ALICE')

  await fixture.emitAuth(authSnapshot({ revision: 2, signedIn: true }))
  await fixture.emitAuth(authSnapshot({ revision: 3, signedIn: false }))
  expect(fixture.search.controlCharacterSearch).not.toHaveBeenCalledWith({
    action: 'end',
    captureId: CAPTURE_ID
  })
  expect(fixture.container.querySelector('select')?.value).toBe('game')
  expect(fixture.container.textContent).toContain('ALICE')
  expect(
    fixture.search.controlCharacterSearch.mock.calls.filter(([input]) => input.action === 'begin')
  ).toHaveLength(1)

  expect(fixture.resources.worker.terminate).toHaveBeenCalledOnce()
})

it('빈 OCR 회차는 이전 capture를 종료하고 빈 이름을 통지하지 않는다', async () => {
  const fixture = createRendererFixture()
  await fixture.mount()
  media.crops.mockReturnValue([document.createElement('canvas'), null, null, null])
  await fixture.start()
  fixture.resources.worker.recognize.mockResolvedValue({
    data: { text: '', confidence: 1, candidates: [] }
  })
  await fixture.click('캡처 시작')
  expect(fixture.search.controlCharacterSearch).toHaveBeenCalledWith({
    action: 'end',
    captureId: CAPTURE_ID
  })
  expect(fixture.container.textContent).not.toContain('ALICE')
  expect(fixture.capture.notifyStableNicknameDetected).toHaveBeenCalledOnce()
  expect(fixture.readCaptureFrame).toHaveBeenCalledTimes(2)
})

it.each(['ended', 'other capture'] as const)(
  'begin 응답보다 새로운 %s snapshot이 먼저 오면 늦은 ID로 media를 시작하지 않는다',
  async (transition) => {
    const fixture = createRendererFixture()
    await fixture.mount()
    const begin = Promise.withResolvers<SearchCommandResult>()
    fixture.search.controlCharacterSearch.mockReturnValueOnce(begin.promise)
    await fixture.start()
    const otherId = '00000000-0000-4000-8000-000000000099'
    const isEnded = transition === 'ended'
    await fixture.emit(searchSnapshot({ captureId: isEnded ? null : otherId, revision: 2 }))
    begin.resolve({ ok: true, snapshot: searchSnapshot({ captureId: CAPTURE_ID, revision: 1 }) })
    await act(async () => undefined)

    expect(fixture.readCaptureFrame).not.toHaveBeenCalled()
    expect(media.worker).not.toHaveBeenCalled()
    expect(fixture.search.controlCharacterSearch).toHaveBeenCalledWith({
      action: 'end',
      captureId: CAPTURE_ID
    })
    expect(fixture.search.controlCharacterSearch).not.toHaveBeenCalledWith({
      action: 'end',
      captureId: otherId
    })
  }
)

it.each(['older end', 'newer same capture'] as const)(
  '%s snapshot은 유효한 begin의 media 시작을 잘못 취소하지 않는다',
  async (transition) => {
    const fixture = createRendererFixture()
    await fixture.mount()
    const begin = Promise.withResolvers<SearchCommandResult>()
    fixture.search.controlCharacterSearch.mockReturnValueOnce(begin.promise)
    await fixture.start()
    const isOlderEnd = transition === 'older end'
    await fixture.emit(
      searchSnapshot({ captureId: isOlderEnd ? null : CAPTURE_ID, revision: isOlderEnd ? 1 : 3 })
    )
    begin.resolve({ ok: true, snapshot: searchSnapshot({ captureId: CAPTURE_ID, revision: 2 }) })
    await act(async () => undefined)
    expect(fixture.readCaptureFrame).toHaveBeenCalledOnce()
    expect(media.worker).toHaveBeenCalledOnce()
    expect(fixture.search.controlCharacterSearch).not.toHaveBeenCalledWith({
      action: 'end',
      captureId: CAPTURE_ID
    })
  }
)

it('취소된 Start의 begin 응답 유실 뒤 read가 새 capture를 찾아도 그 ID를 end하지 않는다', async () => {
  const fixture = createRendererFixture()
  await fixture.mount()
  const previous = Promise.withResolvers<SearchCommandResult>()
  fixture.search.controlCharacterSearch.mockReturnValueOnce(previous.promise)
  await fixture.start()
  await fixture.click('캡처 중지')
  const nextId = '00000000-0000-4000-8000-000000000099'
  const nextSnapshot = searchSnapshot({ captureId: nextId, revision: 3 })
  fixture.search.controlCharacterSearch.mockResolvedValueOnce({ ok: true, snapshot: nextSnapshot })
  await fixture.start()
  await fixture.emit(nextSnapshot)
  previous.reject(new Error('Synthetic old begin response loss'))
  await act(async () => undefined)
  expect(fixture.search.controlCharacterSearch).toHaveBeenLastCalledWith({ action: 'read' })
  expect(fixture.search.controlCharacterSearch).not.toHaveBeenCalledWith({
    action: 'end',
    captureId: nextId
  })
  expect(fixture.readCaptureFrame).toHaveBeenCalledOnce()
})

import { expect, it, vi } from 'vitest'
import { deferred } from '../lib/async-test-fixture'
import {
  candidateResponse,
  createSearchFixture,
  jsonResponse,
  requestPaths
} from './search-test-fixture'

const CAPTURE_SOURCE = 'window:search-fixture'

function lookup(captureId: string, slot: number, observationRevision = 1, nickname = '가나') {
  return { action: 'lookup', captureId, slot, observationRevision, nickname, serverId: 'cain' }
}

function ocr(captureId: string, slot: number, observationRevision = 1, nickname = '가나') {
  return {
    captureId,
    slot,
    observationRevision,
    nickname,
    candidateNicknames: [nickname],
    portrait: null
  }
}

it('창을 고르거나 캡처하지 않아도 파티 직접 조회가 상세까지 채운다', async () => {
  const fixture = await createSearchFixture('manual')
  fixture.fetchSearch.mockResolvedValueOnce(jsonResponse({ body: { rows: [candidateResponse] } }))
  await fixture.startSearch({ slot: 0, observationRevision: 1, nickname: '가나' })
  await vi.waitFor(() =>
    expect(requestPaths(fixture.fetchSearch)).toEqual([
      '/characters/candidates',
      '/characters/cain/synthetic-character'
    ])
  )
  await vi.waitFor(async () =>
    expect((await fixture.read()).slots[0]).toMatchObject({
      state: 'success',
      selectionMethod: 'manual',
      selected: { characterName: '가나', level: 115 }
    })
  )

  expect((await fixture.read()).slots[0]).not.toHaveProperty('details')
  expect(fixture.getSources).not.toHaveBeenCalled()
  for (const args of fixture.fetchSearch.mock.calls) {
    expect(new Request(...args).headers.has('authorization')).toBe(false)
  }
  expect(fixture.published).toHaveBeenLastCalledWith('characterSearchChanged', await fixture.read())
})

it.each([
  ['게임 창 다시 선택', CAPTURE_SOURCE],
  ['캡처 중지', '']
])(
  '%s 뒤에는 회차의 진행 중 OCR 요청과 이전 회차의 OCR 통지를 버리고 직접 조회는 끝까지 반영한다',
  async (_change, nextSource) => {
    const fixture = await createSearchFixture('capture')
    const manualResponse = deferred<Response>()
    const ocrResponse = deferred<Response>()
    fixture.fetchSearch
      .mockReturnValueOnce(manualResponse.promise)
      .mockReturnValueOnce(ocrResponse.promise)
    await fixture.invoke('controlCharacterSearch', lookup(fixture.captureId, 0))
    await fixture.invoke('notifyOcrCandidatesDetected', ocr(fixture.captureId, 1, 1, '다라'))
    await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(2))
    const [manualRequest, ocrRequest] = fixture.fetchSearch.mock.calls.map(
      (args) => new Request(...args)
    )

    await fixture.invoke('selectCaptureSource', nextSource)

    expect(ocrRequest.signal.aborted).toBe(true)
    expect(manualRequest.signal.aborted).toBe(false)
    const afterChange = await fixture.read()
    expect(afterChange.captureId).toBe(fixture.captureId)
    expect(afterChange.slots[1].state).toBe('idle')
    expect(afterChange.slots[0]).toMatchObject({ state: 'pending', nickname: '가나' })
    expect(
      await fixture.invoke('notifyOcrCandidatesDetected', ocr(fixture.captureId, 2))
    ).toMatchObject({ ok: false, error: { code: 'STALE_SEARCH' } })
    ocrResponse.resolve(jsonResponse({ body: { rows: [candidateResponse] } }))
    manualResponse.resolve(jsonResponse({ body: { rows: [candidateResponse] } }))
    await vi.waitFor(async () =>
      expect((await fixture.read()).slots[0]).toMatchObject({
        state: 'success',
        selectionMethod: 'manual'
      })
    )
    expect((await fixture.read()).slots[1].state).toBe('idle')
  }
)

it('창을 바꾼 뒤에는 실패한 OCR 슬롯의 이전 회차 통지를 거절하고 같은 수명에서 실패한 슬롯의 새 직접 조회는 받는다', async () => {
  const fixture = await createSearchFixture('capture')
  const failure = () =>
    jsonResponse({ status: 503, body: { error: { code: 'NEOPLE_UNAVAILABLE', message: '' } } })
  fixture.fetchSearch.mockResolvedValueOnce(failure()).mockResolvedValueOnce(failure())
  await fixture.invoke('notifyOcrCandidatesDetected', ocr(fixture.captureId, 1))
  await fixture.invoke('controlCharacterSearch', lookup(fixture.captureId, 2))
  await vi.waitFor(async () => {
    const slots = (await fixture.read()).slots
    expect([slots[1].state, slots[2].state]).toEqual(['failure', 'failure'])
  })

  await fixture.invoke('selectCaptureSource', CAPTURE_SOURCE)
  const calls = fixture.fetchSearch.mock.calls.length

  expect(
    await fixture.invoke('notifyOcrCandidatesDetected', ocr(fixture.captureId, 1, 2, '다라'))
  ).toMatchObject({ ok: false, error: { code: 'STALE_SEARCH' } })
  expect(fixture.fetchSearch).toHaveBeenCalledTimes(calls)
  expect((await fixture.read()).slots[1].state).toBe('failure')
  fixture.fetchSearch.mockResolvedValueOnce(jsonResponse({ body: { rows: [candidateResponse] } }))
  expect(
    await fixture.invoke('controlCharacterSearch', lookup(fixture.captureId, 2, 2))
  ).toMatchObject({ ok: true })
  await vi.waitFor(async () => expect((await fixture.read()).slots[2].state).toBe('success'))
  expect((await fixture.read()).captureId).toBe(fixture.captureId)
})

it.each(['navigation', 'destruction', 'render-process-gone'])(
  '문서 %s 뒤에는 직접 조회 요청을 취소하고 새 문서의 수명에 늦은 결과를 보내지 않는다',
  async (transition) => {
    const fixture = await createSearchFixture('manual')
    const response = deferred<Response>()
    fixture.fetchSearch.mockReturnValueOnce(response.promise)
    await fixture.startSearch({ slot: 0, observationRevision: 1, nickname: '가나' })
    await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(1))
    const request = new Request(...fixture.fetchSearch.mock.calls[0])
    if (transition === 'navigation') {
      fixture.documentEvents.emit(
        'did-start-navigation',
        {},
        'file:///search-fixture/index.html',
        false,
        true
      )
    } else {
      fixture.documentEvents.emit(
        transition === 'destruction' ? 'destroyed' : 'render-process-gone'
      )
    }
    expect(request.signal.aborted).toBe(true)
    expect((await fixture.read()).captureId).toBeNull()
    fixture.replaceDocument()
    await fixture.invoke('controlCharacterSearch', { action: 'begin' })
    const current = await fixture.read()
    fixture.published.mockClear()
    response.resolve(jsonResponse({ body: { rows: [candidateResponse] } }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(await fixture.read()).toEqual(current)
    expect(fixture.published).not.toHaveBeenCalled()
  }
)

it.each(['sender', 'frame', 'document'])(
  '신뢰하지 않는 %s의 직접 조회는 HTTP 전에 거절한다',
  async (kind) => {
    const fixture = await createSearchFixture('manual')
    if (kind === 'sender') {
      Object.assign(fixture.event, { sender: {} })
    } else if (kind === 'frame') {
      Object.assign(fixture.event, { senderFrame: {} })
    } else {
      Object.assign(fixture.event.senderFrame!, { url: 'about:blank' })
    }
    await expect(
      fixture.startSearch({ slot: 0, observationRevision: 1, nickname: '가나' })
    ).rejects.toThrow('SEARCH_NOT_ALLOWED')
    await expect(fixture.read()).rejects.toThrow('SEARCH_NOT_ALLOWED')
    expect(fixture.fetchSearch).not.toHaveBeenCalled()
  }
)

it('직접 조회도 명령 검증과 관측 revision 순서를 지키고 실패 뒤 새 직접 조회로 다시 조회한다', async () => {
  const fixture = await createSearchFixture('manual')
  expect(
    await fixture.invoke('controlCharacterSearch', lookup(fixture.captureId, 4))
  ).toMatchObject({ ok: false, error: { code: 'INVALID_SEARCH_COMMAND' } })
  await fixture.startSearch({ slot: 0, observationRevision: 1, nickname: ' 가나' })
  expect((await fixture.read()).slots[0].error?.code).toBe('INVALID_SEARCH_QUERY')
  expect(fixture.fetchSearch).not.toHaveBeenCalled()

  fixture.fetchSearch.mockResolvedValueOnce(
    jsonResponse({ status: 500, body: { error: { code: 'INTERNAL_SERVER_ERROR' } } })
  )
  await fixture.startSearch({ slot: 0, observationRevision: 2, nickname: '가나' })
  await vi.waitFor(async () =>
    expect((await fixture.read()).slots[0].error?.code).toBe('INTERNAL_SERVER_ERROR')
  )
  const failed = (await fixture.read()).slots[0]
  await fixture.startSearch({ slot: 0, observationRevision: 1, nickname: '다라' })
  expect((await fixture.read()).slots[0]).toEqual(failed)
  await fixture.startSearch({ slot: 0, observationRevision: 3, nickname: '가나' })
  await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('empty'))
  expect(requestPaths(fixture.fetchSearch)).toEqual([
    '/characters/candidates',
    '/characters/candidates'
  ])
})

it('새 begin은 응답을 잃은 이전 수명을 끝내고 그 수명의 늦은 응답, end, 프레임 읽기를 받지 않는다', async () => {
  const fixture = await createSearchFixture('capture')
  const response = deferred<Response>()
  fixture.fetchSearch.mockReturnValueOnce(response.promise)
  await fixture.startSearch({ slot: 0, observationRevision: 1, nickname: '가나' })
  await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(1))
  const request = new Request(...fixture.fetchSearch.mock.calls[0])

  // 앞선 begin의 응답이 renderer에 닿지 않아도 다음 회차의 begin이 수명을 다시 시작한다.
  const replacement = (await fixture.invoke('controlCharacterSearch', { action: 'begin' })) as {
    ok: boolean
    snapshot: { captureId: string }
  }
  const current = await fixture.read()
  expect(replacement.ok).toBe(true)
  expect(replacement.snapshot.captureId).not.toBe(fixture.captureId)
  expect(current.slots.every((slot) => slot.state === 'idle')).toBe(true)
  expect(request.signal.aborted).toBe(true)
  await expect(fixture.invoke('readCaptureFrame', fixture.captureId)).rejects.toThrow(
    'CAPTURE_NOT_ALLOWED'
  )
  await expect(fixture.invoke('readCaptureFrame', replacement.snapshot.captureId)).resolves.toEqual(
    { kind: 'unsupported' }
  )

  await fixture.invoke('controlCharacterSearch', { action: 'end', captureId: fixture.captureId })
  expect(await fixture.read()).toEqual(current)
  fixture.published.mockClear()
  response.resolve(jsonResponse({ body: { rows: [candidateResponse] } }))
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(await fixture.read()).toEqual(current)
  expect(fixture.published).not.toHaveBeenCalled()

  await fixture.invoke(
    'controlCharacterSearch',
    lookup(replacement.snapshot.captureId, 0, 1, '다라')
  )
  await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('empty'))
  expect(requestPaths(fixture.fetchSearch)).toEqual([
    '/characters/candidates',
    '/characters/candidates'
  ])
})

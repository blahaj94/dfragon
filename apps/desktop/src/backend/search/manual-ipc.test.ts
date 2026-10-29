import { expect, it, vi } from 'vitest'
import { deferred } from '../lib/async-test-fixture'
import {
  candidateResponse,
  createSearchFixture,
  jsonResponse,
  requestPaths
} from './search-test-fixture'

it('manual search works without listing, selecting or capturing a window', async () => {
  const fixture = await createSearchFixture('manual')
  fixture.fetchSearch.mockResolvedValueOnce(jsonResponse({ body: { rows: [candidateResponse] } }))
  await fixture.startSearch({ slot: 0, observationRevision: 1, nickname: '가나' })
  await vi.waitFor(() =>
    expect(requestPaths(fixture.fetchSearch)).toEqual([
      '/characters/candidates',
      '/characters/cain/synthetic-character'
    ])
  )
  expect((await fixture.read()).slots[0].state).toBe('success')

  expect(fixture.getSources).not.toHaveBeenCalled()
  for (const args of fixture.fetchSearch.mock.calls) {
    expect(new Request(...args).headers.has('authorization')).toBe(false)
  }
  expect(await fixture.invoke('controlCharacterSearch', { action: 'read' })).toMatchObject({
    snapshot: { captureId: null }
  })
  await fixture.invoke('selectCaptureSource', 'window:search-fixture')
  expect(await fixture.invoke('controlCharacterSearch', { action: 'read' })).toMatchObject({
    snapshot: { captureId: null }
  })
})

it('capture source and Stop do not cancel manual requests; each channel rejects the other ID', async () => {
  const fixture = await createSearchFixture('manual')
  const response = deferred<Response>()
  fixture.fetchSearch.mockReturnValueOnce(response.promise)
  await fixture.startSearch({ slot: 0, observationRevision: 1, nickname: '가나' })
  await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(1))
  const request = new Request(...fixture.fetchSearch.mock.calls[0])
  await fixture.invoke('selectCaptureSource', 'window:search-fixture')
  const captured = (await fixture.invoke('controlCharacterSearch', { action: 'begin' })) as {
    snapshot: { captureId: string }
  }
  expect(captured.snapshot.captureId).not.toBe(fixture.captureId)
  expect(
    await fixture.invoke('notifyOcrCandidatesDetected', {
      captureId: fixture.captureId,
      slot: 0,
      observationRevision: 2,
      nickname: '다라',
      candidateNicknames: ['다라'],
      portrait: null
    })
  ).toMatchObject({ ok: false, error: { code: 'STALE_SEARCH' } })
  expect(
    await fixture.invoke('controlManualSearch', {
      action: 'lookup',
      captureId: captured.snapshot.captureId,
      slot: 0,
      observationRevision: 2,
      nickname: '다라',
      serverId: 'cain'
    })
  ).toMatchObject({ ok: false, error: { code: 'STALE_SEARCH' } })
  await expect(fixture.invoke('readCaptureFrame', fixture.captureId)).rejects.toThrow(
    'CAPTURE_NOT_ALLOWED'
  )
  await fixture.invoke('controlCharacterSearch', {
    action: 'end',
    captureId: captured.snapshot.captureId
  })
  await fixture.invoke('selectCaptureSource', '')

  expect(request.signal.aborted).toBe(false)
  expect((await fixture.read()).captureId).toBe(fixture.captureId)
  response.resolve(jsonResponse({ body: { rows: [candidateResponse] } }))
  await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('success'))
})

it.each(['navigation', 'destruction', 'render-process-gone'])(
  'manual %s aborts and discards late results after a new document begins',
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
    await fixture.invoke('controlManualSearch', { action: 'begin' })
    const current = await fixture.read()
    fixture.published.mockClear()
    response.resolve(jsonResponse({ body: { rows: [candidateResponse] } }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(await fixture.read()).toEqual(current)
    expect(fixture.published).not.toHaveBeenCalled()
  }
)

it.each(['sender', 'frame', 'document'])(
  'manual IPC rejects untrusted %s before HTTP',
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

it('manual input keeps exact command validation, retry and revision ordering', async () => {
  const fixture = await createSearchFixture('manual')
  expect(
    await fixture.invoke('controlManualSearch', {
      action: 'lookup',
      captureId: fixture.captureId,
      slot: 4,
      observationRevision: 1,
      nickname: '가나',
      serverId: 'cain'
    })
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
  await fixture.invoke('controlManualSearch', {
    action: 'retry',
    captureId: fixture.captureId,
    slot: 0,
    requestId: failed.requestId
  })
  await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('empty'))
  expect(requestPaths(fixture.fetchSearch)).toEqual([
    '/characters/candidates',
    '/characters/candidates'
  ])
})

it('ending manual search leaves an active capture request and its frame access intact', async () => {
  const fixture = await createSearchFixture()
  const response = deferred<Response>()
  fixture.fetchSearch.mockReturnValueOnce(response.promise)
  await fixture.startSearch({ slot: 0, observationRevision: 1, nickname: '가나' })
  await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(1))
  const request = new Request(...fixture.fetchSearch.mock.calls[0])
  const manual = (await fixture.invoke('controlManualSearch', { action: 'begin' })) as {
    snapshot: { captureId: string }
  }

  await fixture.invoke('controlManualSearch', {
    action: 'end',
    captureId: manual.snapshot.captureId
  })

  expect(request.signal.aborted).toBe(false)
  expect((await fixture.read()).captureId).toBe(fixture.captureId)
  await expect(fixture.invoke('readCaptureFrame', fixture.captureId)).resolves.toEqual({
    kind: 'unsupported'
  })
  response.resolve(jsonResponse({ body: { rows: [candidateResponse] } }))
  await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('success'))
})

it('manual begin replaces an orphaned session and ignores its late response and end', async () => {
  const fixture = await createSearchFixture('manual')
  const response = deferred<Response>()
  fixture.fetchSearch.mockReturnValueOnce(response.promise)
  await fixture.startSearch({ slot: 0, observationRevision: 1, nickname: '가나' })
  await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(1))
  const request = new Request(...fixture.fetchSearch.mock.calls[0])
  await fixture.invoke('selectCaptureSource', 'window:search-fixture')
  const capture = (await fixture.invoke('controlCharacterSearch', { action: 'begin' })) as {
    snapshot: { captureId: string }
  }

  // The UI may lose a committed begin response; a fresh submit can replace that session.
  const replacement = (await fixture.invoke('controlManualSearch', { action: 'begin' })) as {
    snapshot: { captureId: string }
  }
  const current = await fixture.read()
  expect(replacement.snapshot.captureId).not.toBe(fixture.captureId)
  expect(current.slots.every((slot) => slot.state === 'idle')).toBe(true)
  expect(request.signal.aborted).toBe(true)
  expect(await fixture.invoke('controlCharacterSearch', { action: 'read' })).toEqual(capture)
  await expect(fixture.invoke('readCaptureFrame', capture.snapshot.captureId)).resolves.toEqual({
    kind: 'unsupported'
  })

  await fixture.invoke('controlManualSearch', { action: 'end', captureId: fixture.captureId })
  expect(await fixture.read()).toEqual(current)
  fixture.published.mockClear()
  response.resolve(jsonResponse({ body: { rows: [candidateResponse] } }))
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(await fixture.read()).toEqual(current)
  expect(fixture.published).not.toHaveBeenCalled()

  await fixture.invoke('controlManualSearch', {
    action: 'lookup',
    captureId: replacement.snapshot.captureId,
    slot: 0,
    observationRevision: 1,
    nickname: '다라',
    serverId: 'cain'
  })
  await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('empty'))
  expect(requestPaths(fixture.fetchSearch)).toEqual([
    '/characters/candidates',
    '/characters/candidates'
  ])
})

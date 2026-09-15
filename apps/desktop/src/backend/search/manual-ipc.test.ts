import { expect, it, vi } from 'vitest'
import { deferred } from '../auth/auth-test-fixtures'
import { candidate, createSearchFixture, jsonResponse } from './search-test-fixture'

it('manual search works signed out without listing, selecting or capturing a window', async () => {
  const fixture = await createSearchFixture(false, 'manual')
  fixture.fetchSearch.mockResolvedValueOnce(jsonResponse({ body: { rows: [candidate] } }))
  await fixture.observe({ slot: 0, observationRevision: 1, nickname: '가나' })
  await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('success'))

  expect(fixture.getSources).not.toHaveBeenCalled()
  expect(fixture.auth.getSnapshot().phase).toBe('signedOut')
  expect(new Request(...fixture.fetchSearch.mock.calls[0]).headers.has('authorization')).toBe(false)
  expect(fixture.mediaPermissionAllowed()).toBe(false)
  expect(await fixture.requestMedia()).toBeNull()
  expect(await fixture.invoke('controlCharacterSearch', { action: 'read' })).toMatchObject({
    snapshot: { captureId: null }
  })
  await fixture.invoke('selectCaptureSource', 'window:search-fixture')
  expect(fixture.mediaPermissionAllowed()).toBe(false)
  expect(await fixture.requestMedia()).toBeNull()
})

it('capture source and Stop do not cancel manual requests; each channel rejects the other ID', async () => {
  const fixture = await createSearchFixture(false, 'manual')
  const response = deferred<Response>()
  fixture.fetchSearch.mockReturnValueOnce(response.promise)
  await fixture.observe({ slot: 0, observationRevision: 1, nickname: '가나' })
  await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(1))
  const request = new Request(...fixture.fetchSearch.mock.calls[0])
  await fixture.invoke('selectCaptureSource', 'window:search-fixture')
  const captured = (await fixture.invoke('controlCharacterSearch', { action: 'begin' })) as {
    snapshot: { captureId: string; runId: string }
  }
  expect(captured.snapshot.captureId).not.toBe(fixture.captureId)
  expect(captured.snapshot.runId).not.toBe((await fixture.read()).runId)
  expect(
    await fixture.invoke('notifyStableNicknameDetected', {
      captureId: fixture.captureId,
      slot: 0,
      observationRevision: 2,
      nickname: '다라'
    })
  ).toMatchObject({ ok: false, error: { code: 'STALE_SEARCH' } })
  expect(
    await fixture.invoke('notifyManualNickname', {
      captureId: captured.snapshot.captureId,
      slot: 0,
      observationRevision: 2,
      nickname: '다라'
    })
  ).toMatchObject({ ok: false, error: { code: 'STALE_SEARCH' } })
  await fixture.invoke('controlCharacterSearch', {
    action: 'end',
    captureId: captured.snapshot.captureId
  })
  await fixture.invoke('selectCaptureSource', '')

  expect(request.signal.aborted).toBe(false)
  expect((await fixture.read()).captureId).toBe(fixture.captureId)
  response.resolve(jsonResponse({ body: { rows: [candidate] } }))
  await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('success'))
})

it.each(['navigation', 'destruction', 'render-process-gone'])(
  'manual %s aborts and discards late results after a new document begins',
  async (transition) => {
    const fixture = await createSearchFixture(false, 'manual')
    const response = deferred<Response>()
    fixture.fetchSearch.mockReturnValueOnce(response.promise)
    await fixture.observe({ slot: 0, observationRevision: 1, nickname: '가나' })
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
    response.resolve(jsonResponse({ body: { rows: [candidate] } }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(await fixture.read()).toEqual(current)
    expect(fixture.published).not.toHaveBeenCalled()
  }
)

it.each(['sender', 'frame', 'document'])(
  'manual IPC rejects untrusted %s before HTTP',
  async (kind) => {
    const fixture = await createSearchFixture(false, 'manual')
    if (kind === 'sender') {
      Object.assign(fixture.event, { sender: {} })
    } else if (kind === 'frame') {
      Object.assign(fixture.event, { senderFrame: {} })
    } else {
      Object.assign(fixture.event.senderFrame!, { url: 'about:blank' })
    }
    await expect(
      fixture.observe({ slot: 0, observationRevision: 1, nickname: '가나' })
    ).rejects.toThrow('SEARCH_NOT_ALLOWED')
    await expect(fixture.read()).rejects.toThrow('SEARCH_NOT_ALLOWED')
    expect(fixture.fetchSearch).not.toHaveBeenCalled()
  }
)

it('manual input keeps exact command validation, retry and revision ordering', async () => {
  const fixture = await createSearchFixture(false, 'manual')
  expect(
    await fixture.invoke('notifyManualNickname', {
      captureId: fixture.captureId,
      slot: 4,
      observationRevision: 1,
      nickname: '가나'
    })
  ).toMatchObject({ ok: false, error: { code: 'INVALID_SEARCH_COMMAND' } })
  await fixture.observe({ slot: 0, observationRevision: 1, nickname: ' 가나' })
  expect((await fixture.read()).slots[0].error?.code).toBe('INVALID_SEARCH_QUERY')
  expect(fixture.fetchSearch).not.toHaveBeenCalled()

  fixture.fetchSearch.mockResolvedValueOnce(
    jsonResponse({ status: 500, body: { error: { code: 'INTERNAL_SERVER_ERROR' } } })
  )
  await fixture.observe({ slot: 0, observationRevision: 2, nickname: '가나' })
  await vi.waitFor(async () =>
    expect((await fixture.read()).slots[0].error?.code).toBe('INTERNAL_SERVER_ERROR')
  )
  const failed = (await fixture.read()).slots[0]
  await fixture.observe({ slot: 0, observationRevision: 1, nickname: '다라' })
  expect((await fixture.read()).slots[0]).toEqual(failed)
  await fixture.invoke('controlManualSearch', {
    action: 'retry',
    captureId: fixture.captureId,
    slot: 0,
    requestId: failed.requestId
  })
  await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('empty'))
  expect(fixture.fetchSearch).toHaveBeenCalledTimes(2)
})

it('ending manual search leaves an active capture request and its media permission intact', async () => {
  const fixture = await createSearchFixture()
  const response = deferred<Response>()
  fixture.fetchSearch.mockReturnValueOnce(response.promise)
  await fixture.observe({ slot: 0, observationRevision: 1, nickname: '가나' })
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
  expect(fixture.mediaPermissionAllowed()).toBe(true)
  response.resolve(jsonResponse({ body: { rows: [candidate] } }))
  await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('success'))
})

it('manual begin replaces an orphaned session and ignores its late response and end', async () => {
  const fixture = await createSearchFixture(false, 'manual')
  const response = deferred<Response>()
  fixture.fetchSearch.mockReturnValueOnce(response.promise)
  await fixture.observe({ slot: 0, observationRevision: 1, nickname: '가나' })
  await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(1))
  const request = new Request(...fixture.fetchSearch.mock.calls[0])
  await fixture.invoke('selectCaptureSource', 'window:search-fixture')
  const capture = await fixture.invoke('controlCharacterSearch', { action: 'begin' })

  // The UI may lose a committed begin response; a fresh submit can replace that session.
  const replacement = (await fixture.invoke('controlManualSearch', { action: 'begin' })) as {
    snapshot: { captureId: string }
  }
  const current = await fixture.read()
  expect(replacement.snapshot.captureId).not.toBe(fixture.captureId)
  expect(current.slots.every((slot) => slot.state === 'idle')).toBe(true)
  expect(request.signal.aborted).toBe(true)
  expect(await fixture.invoke('controlCharacterSearch', { action: 'read' })).toEqual(capture)
  expect(fixture.mediaPermissionAllowed()).toBe(true)

  await fixture.invoke('controlManualSearch', { action: 'end', captureId: fixture.captureId })
  expect(await fixture.read()).toEqual(current)
  fixture.published.mockClear()
  response.resolve(jsonResponse({ body: { rows: [candidate] } }))
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(await fixture.read()).toEqual(current)
  expect(fixture.published).not.toHaveBeenCalled()

  await fixture.invoke('notifyManualNickname', {
    captureId: replacement.snapshot.captureId,
    slot: 0,
    observationRevision: 1,
    nickname: '다라'
  })
  await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('empty'))
  expect(fixture.fetchSearch).toHaveBeenCalledTimes(2)
})

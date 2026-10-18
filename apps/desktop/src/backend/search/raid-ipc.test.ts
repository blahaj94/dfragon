import { expect, it, vi } from 'vitest'
import { deferred } from '../auth/auth-test-fixtures'
import { candidate, createSearchFixture, jsonResponse } from './search-test-fixture'

// 공대 카드 조회는 지정 서버의 상세를 고르는 식별 경로를 쓴다. 합성 픽셀용 테스트 정책이며 운영 기준이 아니다.
const policy = { maxMeanChannelError: 0, minCoverage: 1, minComparedPixels: 1 }
const imageUrl =
  'https://img-api.neople.co.kr/df/servers/cain/characters/synthetic-character?zoom=1'
const details = {
  character: { ...candidate, level: 110, fame: 71000, guildName: '합성길드' },
  status: { status: [], buff: null },
  equipment: { equipment: [], setItemInfo: [] },
  avatar: null,
  creature: null,
  oath: null,
  mistAssimilation: null,
  skillStyle: null,
  buff: { equipment: null, avatar: null, creature: null },
  sections: Object.fromEntries(
    [
      'basic',
      'status',
      'equipment',
      'avatar',
      'creature',
      'oath',
      'mist_assimilation',
      'skill_style',
      'buff_equipment',
      'buff_avatar',
      'buff_creature'
    ].map((name) => [
      name,
      {
        revision: 1,
        contentUpdatedAt: '2026-10-07T00:00:00.000Z',
        lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z'
      }
    ])
  ),
  freshness: {
    lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z',
    expiresAt: '2026-10-07T00:05:00.000Z'
  }
}

function lookup(captureId: string, slot: number, observationRevision = 1, nickname = '가나') {
  return { action: 'lookup', captureId, slot, observationRevision, nickname, serverId: 'cain' }
}

function respondFound(fixture: Awaited<ReturnType<typeof createSearchFixture>>): void {
  fixture.fetchSearch
    .mockResolvedValueOnce(jsonResponse({ body: { rows: [{ ...candidate, imageUrl }] } }))
    .mockResolvedValueOnce(jsonResponse({ body: details }))
}

it('공대 수명은 12자리를 갖고 12번째 자리까지 조회하며 범위 밖 자리는 HTTP 전에 거절한다', async () => {
  const fixture = await createSearchFixture(false, 'raid', policy)
  expect((await fixture.read()).slots.map((slot) => slot.slot)).toEqual(
    Array.from({ length: 12 }, (_, slot) => slot)
  )
  for (const slot of [-1, 12, 1.5]) {
    expect(
      await fixture.invoke('controlRaidSearch', lookup(fixture.captureId, slot))
    ).toMatchObject({ ok: false, error: { code: 'INVALID_SEARCH_COMMAND' } })
  }
  // 파티 카드 수명은 그대로 네 자리만 받는다.
  expect(await fixture.invoke('controlManualSearch', lookup(fixture.captureId, 4))).toMatchObject({
    ok: false,
    error: { code: 'INVALID_SEARCH_COMMAND' }
  })
  expect(fixture.fetchSearch).not.toHaveBeenCalled()

  respondFound(fixture)
  await fixture.invoke('controlRaidSearch', lookup(fixture.captureId, 11))
  await vi.waitFor(async () => expect((await fixture.read()).slots[11].state).toBe('success'))
  const snapshot = await fixture.read()
  expect(snapshot.slots[11]).toMatchObject({
    selectionMethod: 'manual',
    selected: {
      characterName: '가나',
      guildName: '합성길드',
      equipmentScore: null,
      serverRank: null
    }
  })
  expect(snapshot.slots.slice(0, 11).every((slot) => slot.state === 'idle')).toBe(true)
  expect(fixture.published).toHaveBeenCalledWith('raidSearchChanged', snapshot)
})

it('공대와 파티 카드 조회는 같은 자리 번호에서도 서로의 결과와 요청을 바꾸지 않는다', async () => {
  const fixture = await createSearchFixture(false, 'raid', policy)
  const raidResponse = deferred<Response>()
  fixture.fetchSearch.mockReturnValueOnce(raidResponse.promise)
  await fixture.invoke('controlRaidSearch', lookup(fixture.captureId, 0))
  await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(1))
  const raidRequest = new Request(...fixture.fetchSearch.mock.calls[0])

  const party = (await fixture.invoke('controlManualSearch', { action: 'begin' })) as {
    snapshot: { captureId: string }
  }
  // 파티 카드의 수명 ID로 공대 자리를 조회할 수 없고 반대도 같다.
  expect(
    await fixture.invoke('controlRaidSearch', lookup(party.snapshot.captureId, 1))
  ).toMatchObject({ ok: false, error: { code: 'STALE_SEARCH' } })
  expect(await fixture.invoke('controlManualSearch', lookup(fixture.captureId, 0))).toMatchObject({
    ok: false,
    error: { code: 'STALE_SEARCH' }
  })
  await fixture.invoke('controlManualSearch', lookup(party.snapshot.captureId, 0, 1, '다라'))
  await vi.waitFor(async () => {
    const result = (await fixture.invoke('controlManualSearch', { action: 'read' })) as {
      snapshot: { slots: { state: string }[] }
    }
    expect(result.snapshot.slots[0].state).toBe('empty')
  })
  await fixture.invoke('controlManualSearch', {
    action: 'end',
    captureId: party.snapshot.captureId
  })

  expect(raidRequest.signal.aborted).toBe(false)
  expect((await fixture.read()).slots[0]).toMatchObject({ state: 'pending', nickname: '가나' })
  raidResponse.resolve(jsonResponse({ body: { rows: [{ ...candidate, imageUrl }] } }))
  fixture.fetchSearch.mockResolvedValueOnce(jsonResponse({ body: details }))
  await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('success'))
})

it('한 자리를 다시 조회하면 이전 요청을 취소하고 늦은 응답을 버리며 다른 자리 요청은 유지한다', async () => {
  const fixture = await createSearchFixture(false, 'raid', policy)
  const first = deferred<Response>()
  const other = deferred<Response>()
  fixture.fetchSearch.mockReturnValueOnce(first.promise).mockReturnValueOnce(other.promise)
  await fixture.invoke('controlRaidSearch', lookup(fixture.captureId, 5, 1, '이전'))
  await fixture.invoke('controlRaidSearch', lookup(fixture.captureId, 6, 1, '옆자리'))
  await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(2))
  const [firstRequest, otherRequest] = fixture.fetchSearch.mock.calls.map(
    (args) => new Request(...args)
  )

  fixture.fetchSearch.mockResolvedValueOnce(jsonResponse({ body: { rows: [] } }))
  await fixture.invoke('controlRaidSearch', lookup(fixture.captureId, 5, 2, '최신'))
  expect(firstRequest.signal.aborted).toBe(true)
  expect(otherRequest.signal.aborted).toBe(false)
  await vi.waitFor(async () => expect((await fixture.read()).slots[5].state).toBe('empty'))

  first.resolve(jsonResponse({ body: { rows: [{ ...candidate, imageUrl }] } }))
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect((await fixture.read()).slots[5]).toMatchObject({ state: 'empty', nickname: '최신' })
  // 같은 자리의 늦은 이전 관측은 최신 결과를 덮어쓰지 않는다.
  expect(
    await fixture.invoke('controlRaidSearch', lookup(fixture.captureId, 5, 1, '이전'))
  ).toMatchObject({ ok: true })
  expect((await fixture.read()).slots[5].nickname).toBe('최신')
  expect((await fixture.read()).slots[6].state).toBe('pending')
})

it.each(['navigation', 'destruction'])(
  '문서 %s 뒤에는 공대 요청을 취소하고 늦은 결과를 버린다',
  async (transition) => {
    const fixture = await createSearchFixture(false, 'raid', policy)
    const response = deferred<Response>()
    fixture.fetchSearch.mockReturnValueOnce(response.promise)
    await fixture.invoke('controlRaidSearch', lookup(fixture.captureId, 9))
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
      fixture.documentEvents.emit('destroyed')
    }
    expect(request.signal.aborted).toBe(true)
    expect((await fixture.read()).captureId).toBeNull()
    fixture.replaceDocument()
    await fixture.invoke('controlRaidSearch', { action: 'begin' })
    const current = await fixture.read()
    fixture.published.mockClear()
    response.resolve(jsonResponse({ body: { rows: [{ ...candidate, imageUrl }] } }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(await fixture.read()).toEqual(current)
    expect(fixture.published).not.toHaveBeenCalled()
  }
)

it('공대 조회 IPC도 신뢰하지 않는 sender는 HTTP 전에 거절한다', async () => {
  const fixture = await createSearchFixture(false, 'raid', policy)
  Object.assign(fixture.event, { sender: {} })
  await expect(fixture.invoke('controlRaidSearch', lookup(fixture.captureId, 0))).rejects.toThrow(
    'SEARCH_NOT_ALLOWED'
  )
  await expect(
    fixture.invoke('notifyRaidOcrCandidatesDetected', ocr(fixture.captureId, 0))
  ).rejects.toThrow('SEARCH_NOT_ALLOWED')
  expect(fixture.fetchSearch).not.toHaveBeenCalled()
})

// 공대 캡처의 OCR 관측. 공대 상세 창에는 얼굴이 없어 portrait는 늘 null이다.
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

it('공대 OCR 관측은 12번째 자리까지 받아 이름 후보 중 최고 명성 캐릭터를 고르고 범위 밖은 HTTP 전에 거절한다', async () => {
  const fixture = await createSearchFixture(false, 'raid', policy)
  for (const slot of [-1, 12, 1.5]) {
    expect(
      await fixture.invoke('notifyRaidOcrCandidatesDetected', ocr(fixture.captureId, slot))
    ).toMatchObject({ ok: false, error: { code: 'INVALID_SEARCH_COMMAND' } })
  }
  expect(
    await fixture.invoke('notifyRaidOcrCandidatesDetected', {
      ...ocr(fixture.captureId, 0),
      serverId: 'cain'
    })
  ).toMatchObject({ ok: false, error: { code: 'INVALID_SEARCH_COMMAND' } })
  expect(fixture.fetchSearch).not.toHaveBeenCalled()

  const other = {
    ...candidate,
    characterId: 'synthetic-other',
    serverId: 'bakal',
    serverName: '바칼',
    fame: 1
  }
  const otherImageUrl =
    'https://img-api.neople.co.kr/df/servers/bakal/characters/synthetic-other?zoom=1'
  fixture.fetchSearch
    .mockResolvedValueOnce(
      jsonResponse({
        body: {
          rows: [
            { ...candidate, imageUrl },
            { ...other, imageUrl: otherImageUrl }
          ]
        }
      })
    )
    .mockResolvedValueOnce(
      jsonResponse({ body: { ...details, character: { ...details.character, ...other } } })
    )
  await fixture.invoke('notifyRaidOcrCandidatesDetected', ocr(fixture.captureId, 11))
  await vi.waitFor(async () => expect((await fixture.read()).slots[11].state).toBe('success'))
  const snapshot = await fixture.read()
  expect(snapshot.slots[11]).toMatchObject({
    nickname: '가나',
    selectionMethod: 'highest-fame',
    selected: { characterId: 'synthetic-other', serverId: 'bakal' }
  })
  // 이름 후보 검색은 서버를 고르지 않고 상세는 고른 후보의 서버로 한 번만 조회한다.
  const urls = fixture.fetchSearch.mock.calls.map(([input]) => new Request(input).url)
  expect(urls).toHaveLength(2)
  expect(urls[0]).toContain('/characters/candidates?characterName=')
  expect(urls[1]).toContain('/characters/bakal/synthetic-other')
  expect(snapshot.slots.slice(0, 11).every((slot) => slot.state === 'idle')).toBe(true)
  expect(fixture.published).toHaveBeenCalledWith('raidSearchChanged', snapshot)
})

it('공대 OCR 관측은 다른 수명의 ID와 파티 캡처 채널로 섞이지 않는다', async () => {
  const fixture = await createSearchFixture(false, 'raid', policy)
  const party = (await fixture.invoke('controlManualSearch', { action: 'begin' })) as {
    snapshot: { captureId: string }
  }
  expect(
    await fixture.invoke('notifyRaidOcrCandidatesDetected', ocr(party.snapshot.captureId, 0))
  ).toMatchObject({ ok: false, error: { code: 'STALE_SEARCH' } })
  // 파티 캡처 채널은 파티 캡처 수명의 네 자리만 받는다.
  expect(
    await fixture.invoke('notifyOcrCandidatesDetected', ocr(fixture.captureId, 11))
  ).toMatchObject({ ok: false, error: { code: 'INVALID_SEARCH_COMMAND' } })
  expect(
    await fixture.invoke('notifyOcrCandidatesDetected', ocr(fixture.captureId, 0))
  ).toMatchObject({ ok: false, error: { code: 'STALE_SEARCH' } })
  expect(fixture.fetchSearch).not.toHaveBeenCalled()
})

it('새 공대 회차가 수명을 다시 시작하면 이전 회차의 늦은 식별 결과를 버린다', async () => {
  const fixture = await createSearchFixture(false, 'raid', policy)
  const response = deferred<Response>()
  fixture.fetchSearch.mockReturnValueOnce(response.promise)
  await fixture.invoke('notifyRaidOcrCandidatesDetected', ocr(fixture.captureId, 3))
  await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(1))
  const request = new Request(...fixture.fetchSearch.mock.calls[0])

  await fixture.invoke('controlRaidSearch', { action: 'begin' })
  const next = await fixture.read()
  expect(next.captureId).not.toBe(fixture.captureId)
  expect(request.signal.aborted).toBe(true)
  expect(
    await fixture.invoke('notifyRaidOcrCandidatesDetected', ocr(fixture.captureId, 3, 2))
  ).toMatchObject({ ok: false, error: { code: 'STALE_SEARCH' } })
  response.resolve(jsonResponse({ body: { rows: [{ ...candidate, imageUrl }] } }))
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(await fixture.read()).toEqual(next)
  expect(next.slots[3].state).toBe('idle')
})

import { describe, expect, it, vi } from 'vitest'
import { deferred } from '../lib/async-test-fixture'
import type { SearchSlot } from '../../preload/common/types/search'
import { API_ORIGIN } from './search-test-fixture'
import {
  candidate,
  candidateResponse,
  createSearchFixture,
  jsonResponse,
  requestPaths
} from './search-test-fixture'

type Fixture = Awaited<ReturnType<typeof createSearchFixture>>

const detailsPath = `/characters/${candidate.serverId}/${candidate.characterId}`

async function detailsSettled(fixture: Fixture): Promise<SearchSlot> {
  await vi.waitFor(async () => {
    const slot = (await fixture.read()).slots[0]
    expect(slot.state).toBe('success')
    expect(slot).not.toHaveProperty('details')
  })

  return (await fixture.read()).slots[0]
}

describe('main 검색 관측과 slot 수명', () => {
  it('유효 관측은 pending을 먼저 반환하고 main이 기본 query로 한 번 검색한다', async () => {
    const fixture = await createSearchFixture()
    const response = deferred<Response>()
    fixture.fetchSearch.mockReturnValueOnce(response.promise)

    const admitted = await fixture.startSearch({
      slot: 0,
      observationRevision: 1,
      nickname: '가나'
    })

    expect(admitted).toMatchObject({
      ok: true,
      snapshot: {
        slots: [
          expect.objectContaining({
            state: 'pending',
            observationRevision: 1,
            nickname: '가나',
            requestId: expect.any(String),
            rows: [],
            error: null
          }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Object)
        ]
      }
    })
    await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(1))
    const request = new Request(...fixture.fetchSearch.mock.calls[0])
    const url = new URL(request.url)
    expect(url.origin).toBe(API_ORIGIN)
    expect(url.pathname).toBe('/characters/candidates')
    expect([...url.searchParams.entries()]).toEqual([['characterName', '가나']])
    expect(request.method).toBe('GET')
    expect(request.headers.get('authorization')).toBeNull()
    expect(request.credentials).toBe('omit')
    expect(request.redirect).toBe('error')

    response.resolve(jsonResponse({ body: { rows: [candidateResponse] } }))
    expect(await detailsSettled(fixture)).toMatchObject({ state: 'success', rows: [candidate] })
    expect(requestPaths(fixture.fetchSearch)).toEqual(['/characters/candidates', detailsPath])
  })

  it('후보의 다섯 응답 field만 행으로 보내고 명성 순서의 선택지에도 추가 field를 IPC에 보내지 않는다', async () => {
    const fixture = await createSearchFixture()
    const lower = {
      ...candidateResponse,
      characterId: 'lower-fame',
      serverId: 'bakal',
      serverName: '바칼',
      fame: -1.5,
      imageUrl: 'https://img-api.neople.co.kr/df/servers/bakal/characters/lower-fame?zoom=1'
    }
    fixture.fetchSearch.mockResolvedValueOnce(
      jsonResponse({
        body: {
          rows: [lower, candidateResponse].map((row) => ({ ...row, extra: 'discard' })),
          extra: 'discard'
        }
      })
    )

    const admitted = await fixture.startSearch({
      slot: 0,
      observationRevision: 1,
      nickname: '가나'
    })
    expect(admitted).toMatchObject({ ok: true })

    const slot = await detailsSettled(fixture)
    expect(slot.rows).toEqual([candidate])
    expect(slot.choices).toEqual([
      { ...candidate, adventureName: null, face: null },
      {
        characterId: 'lower-fame',
        characterName: '가나',
        serverId: 'bakal',
        serverName: '바칼',
        fame: -1.5,
        adventureName: null,
        face: null
      }
    ])
    const completed = await fixture.read()
    expect(JSON.stringify(completed)).not.toContain('discard')
    expect(fixture.published).toHaveBeenLastCalledWith('characterSearchChanged', completed)
  })

  it('빈 OCR 이름은 보정하거나 HTTP로 보내지 않고 재시도 없는 입력 실패로 끝낸다', async () => {
    const fixture = await createSearchFixture()

    const admitted = await fixture.startSearch({ slot: 0, observationRevision: 1, nickname: '' })

    expect(admitted).toMatchObject({ ok: true })
    const snapshot = await fixture.read()
    expect(snapshot.slots[0]).toMatchObject({
      state: 'failure',
      nickname: '',
      requestId: expect.any(String),
      rows: [],
      error: { code: 'INVALID_SEARCH_QUERY' }
    })
    expect(fixture.fetchSearch).not.toHaveBeenCalled()
    const retry = await fixture.invoke('controlCharacterSearch', {
      action: 'retry',
      captureId: fixture.captureId,
      slot: 0,
      requestId: snapshot.slots[0].requestId
    })
    expect(retry).toMatchObject({ ok: false, error: { code: 'SEARCH_RETRY_NOT_READY' } })
  })

  it.each(['가나다라마바사아자차카타파', ' 가나', '가나 ', '\ud800가', '가\udfff'])(
    'OCR 통지의 입력 %j는 보정하거나 HTTP로 보내지 않고 명령 오류로 거절한다',
    async (nickname) => {
      const fixture = await createSearchFixture()
      const before = await fixture.read()

      const result = await fixture.startSearch({ slot: 0, observationRevision: 1, nickname })

      expect(result).toEqual({
        ok: false,
        error: { code: 'INVALID_SEARCH_COMMAND' },
        snapshot: before
      })
      expect(fixture.fetchSearch).not.toHaveBeenCalled()
    }
  )

  it.each(['', '가나다라마바사아자차카타파', ' 가나', '가나 ', '\ud800가', '가\udfff'])(
    '서버 지정 조회의 입력 %j는 보정하거나 HTTP로 보내지 않고 재시도 없는 입력 실패로 끝낸다',
    async (nickname) => {
      const fixture = await createSearchFixture('manual')

      const admitted = await fixture.startSearch({ slot: 0, observationRevision: 1, nickname })

      expect(admitted).toMatchObject({ ok: true })
      const snapshot = await fixture.read()
      expect(snapshot.slots[0]).toMatchObject({
        state: 'failure',
        nickname,
        requestId: expect.any(String),
        rows: [],
        error: { code: 'INVALID_SEARCH_QUERY' }
      })
      expect(fixture.fetchSearch).not.toHaveBeenCalled()
      const retry = await fixture.invoke('controlCharacterSearch', {
        action: 'retry',
        captureId: fixture.captureId,
        slot: 0,
        requestId: snapshot.slots[0].requestId
      })
      expect(retry).toMatchObject({ ok: false, error: { code: 'SEARCH_RETRY_NOT_READY' } })
    }
  )

  it.each([2, 12])('보조 평면 문자 %i개 관측을 그대로 검색에 전달한다', async (length) => {
    const fixture = await createSearchFixture()
    const nickname = '😀'.repeat(length)
    fixture.fetchSearch.mockResolvedValueOnce(jsonResponse({ body: { rows: [] } }))

    const admitted = await fixture.startSearch({ slot: 0, observationRevision: 1, nickname })

    expect(admitted).toMatchObject({ ok: true })
    await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(1))
    const request = new Request(...fixture.fetchSearch.mock.calls[0])
    expect(new URL(request.url).searchParams.get('characterName')).toBe(nickname)
  })

  it('네 slot은 독립적으로 진행하며 역순 완료와 0건을 구분한다', async () => {
    const fixture = await createSearchFixture()
    const responses = [
      deferred<Response>(),
      deferred<Response>(),
      deferred<Response>(),
      deferred<Response>()
    ]
    for (const response of responses) {
      fixture.fetchSearch.mockReturnValueOnce(response.promise)
    }
    for (const slot of [0, 1, 2, 3]) {
      const admitted = await fixture.startSearch({ slot, observationRevision: 1, nickname: '가나' })
      expect(admitted).toMatchObject({ ok: true })
    }
    await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(4))

    responses[3].resolve(jsonResponse({ body: { rows: [] } }))
    await vi.waitFor(async () => {
      const snapshot = await fixture.read()
      expect(snapshot.slots.map((slot) => slot.state)).toEqual([
        'pending',
        'pending',
        'pending',
        'empty'
      ])
    })
    responses[1].resolve(jsonResponse({ body: { rows: [candidateResponse] } }))
    responses[2].resolve(jsonResponse({ body: { rows: [] } }))
    responses[0].resolve(jsonResponse({ body: { rows: [candidateResponse] } }))

    await vi.waitFor(async () => {
      const snapshot = await fixture.read()
      expect(snapshot.slots.map((slot) => slot.state)).toEqual([
        'success',
        'success',
        'empty',
        'empty'
      ])
    })
  })

  it.each(['pending', 'success', 'failure'])(
    '같은 nickname의 높은 revision은 %s의 request를 유지하고 완료를 막지 않는다',
    async (state) => {
      const fixture = await createSearchFixture()
      const response = deferred<Response>()
      fixture.fetchSearch.mockReturnValueOnce(response.promise)
      const admitted = await fixture.startSearch({
        slot: 0,
        observationRevision: 1,
        nickname: '가나'
      })
      expect(admitted).toMatchObject({ ok: true })
      await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(1))
      const isPending = state === 'pending'
      const isFailure = state === 'failure'
      if (!isPending) {
        response.resolve(
          isFailure
            ? jsonResponse({
                status: 500,
                body: { error: { code: 'INTERNAL_SERVER_ERROR', message: 'discard' } }
              })
            : jsonResponse({ body: { rows: [candidateResponse] } })
        )
        if (isFailure) {
          await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe(state))
        } else {
          await detailsSettled(fixture)
        }
      }
      const before = await fixture.read()
      const requestsBefore = requestPaths(fixture.fetchSearch)

      await fixture.startSearch({ slot: 0, observationRevision: 3, nickname: '가나' })
      const promoted = await fixture.read()
      expect(promoted.slots[0]).toEqual({ ...before.slots[0], observationRevision: 3 })
      expect(promoted.revision).toBeGreaterThan(before.revision)
      await fixture.startSearch({ slot: 0, observationRevision: 2, nickname: '다라' })
      await fixture.startSearch({ slot: 0, observationRevision: 3, nickname: '다라' })
      expect(await fixture.read()).toEqual(promoted)
      expect(requestPaths(fixture.fetchSearch)).toEqual(requestsBefore)
      expect(requestsBefore.filter((path) => path === '/characters/candidates')).toHaveLength(1)

      if (isPending) {
        response.resolve(jsonResponse({ body: { rows: [candidateResponse] } }))
        await vi.waitFor(async () => {
          expect((await fixture.read()).slots[0]).toMatchObject({
            state: 'success',
            observationRevision: 3,
            requestId: before.slots[0].requestId
          })
        })
      }
    }
  )

  it.each(['success', 'failure'])(
    '새 관측 뒤 이전 요청의 늦은 %s는 현재 slot을 덮지 않는다',
    async (lateState) => {
      const fixture = await createSearchFixture()
      const previous = deferred<Response>()
      fixture.fetchSearch.mockReturnValueOnce(previous.promise)
      expect(
        await fixture.startSearch({ slot: 0, observationRevision: 1, nickname: '가나' })
      ).toMatchObject({ ok: true })
      await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(1))
      const oldRequest = new Request(...fixture.fetchSearch.mock.calls[0])
      const before = await fixture.read()

      expect(
        await fixture.startSearch({ slot: 0, observationRevision: 2, nickname: '다라' })
      ).toMatchObject({ ok: true })
      await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('empty'))
      const current = await fixture.read()
      expect(current.slots[0].requestId).not.toBe(before.slots[0].requestId)
      expect(oldRequest.signal.aborted).toBe(true)
      const isFailure = lateState === 'failure'
      if (isFailure) {
        previous.reject(new Error('Synthetic late failure'))
      } else {
        previous.resolve(jsonResponse({ body: { rows: [candidateResponse] } }))
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 0))

      expect(await fixture.read()).toEqual(current)
      expect(requestPaths(fixture.fetchSearch)).toEqual([
        '/characters/candidates',
        '/characters/candidates'
      ])
    }
  )
})

import { PNG } from 'pngjs'
import { describe, expect, it, vi } from 'vitest'
import type { CharacterDetails, CharacterPortrait } from '../../preload/common/types/character'
import type { OcrSearchObservation } from '../../preload/common/types/search'
import { parseSearchSnapshot } from '../../preload/common/search/snapshot'
import { deferred } from '../auth/auth-test-fixtures'
import { candidate, createSearchFixture, jsonResponse } from './search-test-fixture'

// 동일한 합성 픽셀을 검증하기 위한 테스트 정책이며 운영 기준이 아니다.
const policy = { maxMeanChannelError: 0, minCoverage: 1, minComparedPixels: 2 }
const portrait: CharacterPortrait = {
  image: { width: 2, height: 1, rgba: new Uint8Array([20, 40, 60, 255, 80, 100, 120, 255]) },
  rasterScale: 1
}
const names = ['가나', '다라']
const imageUrl =
  'https://img-api.neople.co.kr/df/servers/cain/characters/synthetic-character?zoom=1'
const matchedCandidate = { ...candidate, fame: 70000, imageUrl }

function details(): CharacterDetails {
  const metadata = {
    revision: 1,
    contentUpdatedAt: '2026-10-07T00:00:00.000Z',
    lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z'
  }

  return {
    character: {
      ...candidate,
      level: 115,
      fame: 71000,
      adventureName: '모험단',
      jobName: '귀검사',
      jobGrowName: '웨펀마스터'
    },
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

function imageResponse(matching = true): Response {
  const data = matching
    ? Buffer.from(portrait.image.rgba)
    : Buffer.from([200, 200, 200, 255, 250, 250, 250, 255])
  const image = new PNG({ width: 2, height: 1 })
  image.data = data
  const png = PNG.sync.write(image)

  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } })
}

type Fixture = Awaited<ReturnType<typeof createSearchFixture>>
function observation(
  fixture: Fixture,
  revision = 1
): OcrSearchObservation & { portrait: CharacterPortrait } {
  return {
    captureId: fixture.captureId,
    slot: 0,
    observationRevision: revision,
    nickname: names[0],
    candidateNicknames: names,
    portrait: structuredClone(portrait)
  }
}

function resolveMatch(fixture: Fixture, detail = details()): void {
  fixture.fetchSearch
    .mockResolvedValueOnce(jsonResponse({ body: { rows: [matchedCandidate] } }))
    .mockResolvedValueOnce(imageResponse())
    .mockResolvedValueOnce(jsonResponse({ body: detail }))
}

describe('OCR 후보 전용 IPC와 기존 캡처 수명', () => {
  it.each([false, true])(
    '정책 유무 %s에서 얼굴이 없으면 HTTP 없이 크롭을 기다린다',
    async (configured) => {
      const fixture = await createSearchFixture(false, 'capture', configured ? policy : undefined)
      await fixture.invoke('notifyOcrCandidatesDetected', {
        ...observation(fixture),
        portrait: null
      })
      const snapshot = await fixture.read()
      expect(snapshot.slots[0]).toMatchObject({ state: 'waiting-portrait', rows: [], error: null })
      expect(snapshot.slots[0].selected).toBeUndefined()
      expect(parseSearchSnapshot(snapshot)).toEqual(snapshot)
      expect(fixture.fetchSearch).not.toHaveBeenCalled()
    }
  )

  it('운영 기본값은 정책 대기이며 일반 검색으로 우회하지 않는다', async () => {
    const fixture = await createSearchFixture()
    await fixture.invoke('notifyOcrCandidatesDetected', observation(fixture))
    const snapshot = await fixture.read()
    expect(snapshot.slots[0]).toMatchObject({ state: 'waiting-policy', rows: [], error: null })
    expect(parseSearchSnapshot(snapshot)).toEqual(snapshot)
    expect(fixture.fetchSearch).not.toHaveBeenCalled()
  })

  it('첫 일치 후보까지만 이미지 비교 후 5필드 행과 실제 상세 요약을 발행한다', async () => {
    const fixture = await createSearchFixture(false, 'capture', policy)
    const earlier = {
      ...matchedCandidate,
      characterId: 'earlier',
      imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/earlier?zoom=1'
    }
    fixture.fetchSearch
      .mockResolvedValueOnce(
        jsonResponse({ body: { rows: [earlier, matchedCandidate, { ...earlier, fame: null }] } })
      )
      .mockResolvedValueOnce(imageResponse(false))
      .mockResolvedValueOnce(imageResponse())
      .mockResolvedValueOnce(jsonResponse({ body: details() }))
    await fixture.invoke('notifyOcrCandidatesDetected', observation(fixture))
    await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('success'))
    const snapshot = await fixture.read()
    expect(snapshot.slots[0].rows).toEqual([{ ...candidate, fame: 70000 }])
    expect(snapshot.slots[0].selected).toEqual({
      ...candidate,
      fame: 71000,
      level: 115,
      adventureName: '모험단',
      jobName: '귀검사',
      jobGrowName: '웨펀마스터',
      imageUrl
    })
    expect(snapshot.slots[0]).not.toHaveProperty('details')
    expect(parseSearchSnapshot(snapshot)).toEqual(snapshot)
    const urls = fixture.fetchSearch.mock.calls.map((args) => new URL(new Request(...args).url))
    expect(urls.map((url) => url.pathname)).toEqual([
      '/characters/candidates',
      '/df/servers/cain/characters/earlier',
      '/df/servers/cain/characters/synthetic-character',
      '/characters/cain/synthetic-character'
    ])
    expect(urls[0].searchParams.get('characterName')).toBe('가나')
  })

  it('표시용 상세 필드가 없거나 다른 JSON 타입이면 가짜 값을 만들지 않는다', async () => {
    const fixture = await createSearchFixture(false, 'capture', policy)
    const detail = details()
    resolveMatch(fixture, {
      ...detail,
      character: {
        ...detail.character,
        adventureName: null,
        jobName: {},
        jobGrowName: [],
        level: '115',
        fame: null
      }
    })
    await fixture.invoke('notifyOcrCandidatesDetected', observation(fixture))
    await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('success'))
    expect((await fixture.read()).slots[0].selected).toMatchObject({
      adventureName: null,
      jobName: null,
      jobGrowName: null,
      level: null,
      fame: null
    })
  })

  it('새 OCR 입력과 일반 검색 간 모드 전환은 같은 대표 이름이어도 이전 선택을 지운다', async () => {
    const fixture = await createSearchFixture(false, 'capture', policy)
    resolveMatch(fixture)
    await fixture.invoke('notifyOcrCandidatesDetected', observation(fixture))
    await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('success'))
    const selected = (await fixture.read()).slots[0]
    await fixture.observe({ slot: 0, observationRevision: 2, nickname: names[0] })
    expect((await fixture.read()).slots[0].selected).toBeUndefined()
    expect((await fixture.read()).slots[0].requestId).not.toBe(selected.requestId)
    await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('empty'))
    expect(new URL(new Request(...fixture.fetchSearch.mock.calls[3]).url).pathname).toBe(
      '/characters'
    )
    await fixture.invoke('notifyOcrCandidatesDetected', {
      ...observation(fixture, 3),
      portrait: null
    })
    expect((await fixture.read()).slots[0]).toMatchObject({ state: 'waiting-portrait', rows: [] })
  })

  it('같은 후보와 보이는 얼굴의 revision은 요청을 유지하고 15초를 연장하지 않는다', async () => {
    const fixture = await createSearchFixture(false, 'capture', policy)
    const response = deferred<Response>()
    fixture.fetchSearch.mockReturnValueOnce(response.promise)
    const input = observation(fixture)
    const masked = { ...input, portrait: { ...input.portrait, validMask: new Uint8Array([1, 0]) } }
    await fixture.invoke('notifyOcrCandidatesDetected', masked)
    await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledOnce())
    const before = await fixture.read()
    fixture.harness.clock.advance(10_000)
    const next = structuredClone(masked)
    next.observationRevision = 2
    next.portrait.image.rgba[4] = 200
    await fixture.invoke('notifyOcrCandidatesDetected', next)
    expect((await fixture.read()).slots[0]).toEqual({ ...before.slots[0], observationRevision: 2 })
    fixture.harness.clock.advance(5_000)
    await vi.waitFor(async () =>
      expect((await fixture.read()).slots[0].error?.code).toBe('SEARCH_TIMEOUT')
    )
    expect(fixture.fetchSearch).toHaveBeenCalledOnce()
    response.resolve(jsonResponse({ body: { rows: [] } }))
  })

  it.each(['후보 순서', '얼굴 픽셀'] as const)(
    '%s 변경은 진행 중 요청을 취소한다',
    async (change) => {
      const fixture = await createSearchFixture(false, 'capture', policy)
      const response = deferred<Response>()
      fixture.fetchSearch.mockReturnValueOnce(response.promise)
      await fixture.invoke('notifyOcrCandidatesDetected', observation(fixture))
      await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledOnce())
      const request = new Request(...fixture.fetchSearch.mock.calls[0])
      const before = await fixture.read()
      const next = { ...observation(fixture, 2) }
      if (change === '후보 순서') {
        next.candidateNicknames = ['가나', '마바']
      } else {
        next.portrait.image.rgba[0] += 1
      }
      await fixture.invoke('notifyOcrCandidatesDetected', next)
      expect(request.signal.aborted).toBe(true)
      await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('empty'))
      const current = await fixture.read()
      expect(current.slots[0].requestId).not.toBe(before.slots[0].requestId)
      response.resolve(jsonResponse({ body: { rows: [matchedCandidate] } }))
      await vi.waitFor(() => expect(request.signal.aborted).toBe(true))
      expect(await fixture.read()).toEqual(current)
    }
  )

  it('재시도는 입력 픽셀 복사본과 두 OCR 이름을 유지하며 429 뒤 자동 호출하지 않는다', async () => {
    const fixture = await createSearchFixture(false, 'capture', policy)
    fixture.fetchSearch.mockResolvedValueOnce(
      jsonResponse({
        status: 429,
        body: { error: { code: 'SEARCH_RATE_LIMITED' } },
        headers: { 'Retry-After': '2' }
      })
    )
    const input = observation(fixture)
    await fixture.invoke('notifyOcrCandidatesDetected', input)
    input.portrait.image.rgba.fill(0)
    await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('failure'))
    const failed = await fixture.read()
    const retry = {
      action: 'retry',
      captureId: fixture.captureId,
      slot: 0,
      requestId: failed.slots[0].requestId
    }
    expect(await fixture.invoke('controlCharacterSearch', retry)).toMatchObject({
      ok: false,
      error: { code: 'SEARCH_RETRY_NOT_READY' }
    })
    fixture.harness.clock.advance(2_000)
    expect(fixture.fetchSearch).toHaveBeenCalledOnce()
    // 둘째 이름의 후보 응답도 해당 검색어를 그대로 반환한다.
    fixture.fetchSearch.mockReset()
    fixture.fetchSearch
      .mockResolvedValueOnce(jsonResponse({ body: { rows: [] } }))
      .mockResolvedValueOnce(
        jsonResponse({ body: { rows: [{ ...matchedCandidate, characterName: '다라' }] } })
      )
      .mockResolvedValueOnce(imageResponse())
      .mockResolvedValueOnce(
        jsonResponse({
          body: { ...details(), character: { ...details().character, characterName: '다라' } }
        })
      )
    expect(await fixture.invoke('controlCharacterSearch', retry)).toMatchObject({ ok: true })
    await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('success'))
    const urls = fixture.fetchSearch.mock.calls.map((args) => new URL(new Request(...args).url))
    expect(urls.slice(0, 2).map((url) => url.searchParams.get('characterName'))).toEqual(names)
    expect(urls.slice(0, 2).every((url) => url.pathname === '/characters/candidates')).toBe(true)
    expect((await fixture.read()).slots[0].selected?.characterName).toBe('다라')
  })

  it.each(['종료', 'source', 'navigation', 'destroyed', 'render-process-gone'] as const)(
    '%s 뒤 늦은 결과는 선택이나 캡처를 복원하지 않는다',
    async (cause) => {
      const fixture = await createSearchFixture(false, 'capture', policy)
      const response = deferred<Response>()
      fixture.fetchSearch.mockReturnValueOnce(response.promise)
      await fixture.invoke('notifyOcrCandidatesDetected', observation(fixture))
      await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledOnce())
      const request = new Request(...fixture.fetchSearch.mock.calls[0])
      if (cause === '종료') {
        await fixture.invoke('controlCharacterSearch', {
          action: 'end',
          captureId: fixture.captureId
        })
      } else if (cause === 'source') {
        await fixture.invoke('selectCaptureSource', '')
      } else if (cause === 'navigation') {
        fixture.documentEvents.emit('did-start-navigation', {}, 'file:///other.html', false, true)
      } else {
        fixture.documentEvents.emit(cause)
      }
      expect(request.signal.aborted).toBe(true)
      response.resolve(jsonResponse({ body: { rows: [matchedCandidate] } }))
      expect((await fixture.read()).captureId).toBeNull()
      expect(
        (await fixture.read()).slots.every(
          (slot) => slot.state === 'idle' && slot.selected === undefined
        )
      ).toBe(true)
    }
  )

  it('잘못된 OCR, 오래된 capture와 revision은 진행 중 수명을 변경하지 않는다', async () => {
    const fixture = await createSearchFixture(false, 'capture', policy)
    const response = deferred<Response>()
    fixture.fetchSearch.mockReturnValueOnce(response.promise)
    await fixture.invoke('notifyOcrCandidatesDetected', observation(fixture))
    await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledOnce())
    const request = new Request(...fixture.fetchSearch.mock.calls[0])
    const before = await fixture.read()
    fixture.published.mockClear()
    expect(
      await fixture.invoke('notifyOcrCandidatesDetected', {
        ...observation(fixture, 2),
        candidateNicknames: ['가나', '다라', '마바']
      })
    ).toMatchObject({ ok: false, error: { code: 'INVALID_SEARCH_COMMAND' } })
    expect(
      await fixture.invoke('notifyOcrCandidatesDetected', {
        ...observation(fixture, 2),
        captureId: '00000000-0000-4000-8000-000000000099'
      })
    ).toMatchObject({ ok: false, error: { code: 'STALE_SEARCH' } })
    await fixture.invoke('notifyOcrCandidatesDetected', { ...observation(fixture), portrait: null })
    expect(await fixture.read()).toEqual(before)
    expect(fixture.published).not.toHaveBeenCalled()
    expect(request.signal.aborted).toBe(false)
    response.resolve(jsonResponse({ body: { rows: [] } }))
  })

  it.each(['sender', 'frame', 'document'] as const)(
    '%s가 다르면 OCR 결과를 접수하거나 snapshot을 노출하지 않는다',
    async (boundary) => {
      const fixture = await createSearchFixture(false, 'capture', policy)
      if (boundary === 'sender') {
        Object.assign(fixture.event, { sender: {} })
      } else if (boundary === 'frame') {
        Object.assign(fixture.event, { senderFrame: { ...fixture.event.senderFrame } })
      } else {
        Object.assign(fixture.event.senderFrame!, { url: 'https://untrusted.example/' })
      }
      await expect(
        fixture.invoke('notifyOcrCandidatesDetected', observation(fixture))
      ).rejects.toThrow('SEARCH_NOT_ALLOWED')
      expect(fixture.fetchSearch).not.toHaveBeenCalled()
    }
  )
})

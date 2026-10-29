import { describe, expect, it, onTestFinished, vi } from 'vitest'
import type { MockedFunction } from 'vitest'
import type { CharacterCandidate, CharacterDetails } from '../../preload/common/types/character'
import type { CharacterCandidatesHttp, CharacterDetailsHttp } from './character-http'
import { createCaptureSearchLifetime } from './capture-lifetime'
import { deferred } from '../lib/async-test-fixture'
import { SearchHttpFailure } from './http'
import { INITIAL_PORTRAIT_COLOR_POLICY } from './portrait-policy'

vi.mock('electron', () => ({ session: { fromPartition: vi.fn() } }))

function candidate(name: string): CharacterCandidate {
  return {
    characterId: `id-${name}`,
    characterName: name,
    serverId: 'cain',
    serverName: '카인',
    fame: 50_000,
    imageUrl: `https://img-api.neople.co.kr/df/servers/cain/characters/id-${name}?zoom=1`,
    adventureName: null,
    jobName: '귀검사(남)',
    jobGrowName: '眞 웨펀마스터'
  }
}

function details(characterId: string): CharacterDetails {
  return {
    character: {
      characterId,
      serverId: 'cain',
      serverName: '카인',
      characterName: characterId.slice(3),
      level: 115,
      guildName: '합성길드'
    },
    status: { status: [], buff: null },
    equipment: { equipment: [], setItemInfo: [] },
    avatar: null,
    creature: null,
    oath: null,
    mistAssimilation: null,
    skillStyle: null,
    buff: { equipment: null, avatar: null, creature: null },
    sections: {},
    freshness: {
      lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z',
      expiresAt: '2026-10-07T00:05:00.000Z'
    }
  }
}

const NAMES = ['가나', '다라', '마바']

function fixture() {
  const searches = new Map(NAMES.map((name) => [name, deferred<CharacterCandidate[]>()]))
  const candidates: MockedFunction<CharacterCandidatesHttp> = vi.fn(
    ({ nickname }) => searches.get(nickname)!.promise
  )
  const loads: Array<{ characterId: string; signal: AbortSignal; resolve: () => void }> = []
  const getDetails: MockedFunction<CharacterDetailsHttp> = vi.fn(
    ({ characterId, signal }) =>
      new Promise<CharacterDetails>((resolve) => {
        loads.push({ characterId, signal, resolve: () => resolve(details(characterId)) })
      })
  )
  const lifetime = createCaptureSearchLifetime({
    publish: vi.fn(),
    isCurrent: () => true,
    isCurrentOcr: () => true,
    runtime: {
      identification: {
        candidates,
        image: vi.fn(),
        details: getDetails,
        scorePortrait: vi.fn(),
        selection: INITIAL_PORTRAIT_COLOR_POLICY
      },
      scoreEngine: { calculate: async () => null, prepare: vi.fn() }
    }
  })
  const captureId = lifetime.begin({ windowGeneration: 1, sourceGeneration: 1 }).snapshot.captureId!
  onTestFinished(() => lifetime.invalidate())
  for (const [slot, nickname] of NAMES.entries()) {
    lifetime.observeOcr({
      captureId,
      slot,
      observationRevision: 1,
      nickname,
      candidateNicknames: [nickname],
      portrait: null
    })
  }
  const identify = async (slot: number) => {
    const nickname = NAMES[slot]
    searches.get(nickname)!.resolve([candidate(nickname)])
    await vi.waitFor(() => expect(lifetime.snapshot().slots[slot].state).toBe('success'))
  }

  const rejectSearch = (slot: number, error: Error) => searches.get(NAMES[slot])!.reject(error)

  return { lifetime, captureId, candidates, getDetails, loads, identify, rejectSearch }
}

describe('이름과 서버를 정한 뒤 상세를 채우는 순서', () => {
  it('모든 슬롯이 이름과 서버를 정할 때까지 상세를 받지 않는다', async () => {
    const f = fixture()

    await f.identify(1)
    await f.identify(0)

    expect(f.lifetime.snapshot().slots[1]).toMatchObject({
      details: 'pending',
      selected: { characterName: '다라', jobGrowName: '眞 웨펀마스터', level: null, card: null }
    })
    expect(f.getDetails).not.toHaveBeenCalled()

    await f.identify(2)

    await vi.waitFor(() => expect(f.getDetails).toHaveBeenCalledOnce())
    expect(f.loads[0].characterId).toBe('id-가나')
  })

  it('상세는 슬롯 순서로 한 번에 하나씩 받고 받은 슬롯의 요약을 채운다', async () => {
    const f = fixture()
    await f.identify(2)
    await f.identify(0)
    await f.identify(1)
    await vi.waitFor(() => expect(f.loads).toHaveLength(1))

    f.loads[0].resolve()

    await vi.waitFor(() => expect(f.loads).toHaveLength(2))
    const first = f.lifetime.snapshot().slots[0]
    expect(first).not.toHaveProperty('details')
    expect(first.selected).toMatchObject({ level: 115, guildName: '합성길드' })
    expect(f.lifetime.snapshot().slots[1].details).toBe('pending')
    f.loads[1].resolve()
    await vi.waitFor(() => expect(f.loads).toHaveLength(3))
    f.loads[2].resolve()
    await vi.waitFor(() =>
      expect(f.lifetime.snapshot().slots.some((slot) => slot.details !== undefined)).toBe(false)
    )
    expect(f.loads.map(({ characterId }) => characterId)).toEqual(['id-가나', 'id-다라', 'id-마바'])
  })

  it('상세를 받지 못하면 고른 이름과 서버는 두고 그 슬롯만 실패로 표시한 뒤 다음 슬롯을 받는다', async () => {
    const f = fixture()
    f.getDetails.mockRejectedValueOnce(new SearchHttpFailure('NEOPLE_API_ERROR'))
    await f.identify(0)
    await f.identify(1)
    await f.identify(2)

    await vi.waitFor(() => expect(f.lifetime.snapshot().slots[0].details).toBe('failed'))
    expect(f.lifetime.snapshot().slots[0]).toMatchObject({
      state: 'success',
      error: null,
      selected: { characterName: '가나', card: null }
    })
    await vi.waitFor(() =>
      expect(f.loads.map(({ characterId }) => characterId)).toEqual(['id-다라'])
    )
  })

  it('상세가 호출 제한을 받으면 남은 상세도 실패로 두고 더 요청하지 않는다', async () => {
    const f = fixture()
    f.getDetails.mockRejectedValueOnce(new SearchHttpFailure('SEARCH_RATE_LIMITED'))
    await f.identify(0)
    await f.identify(1)
    await f.identify(2)

    await vi.waitFor(() =>
      expect(
        f.lifetime
          .snapshot()
          .slots.slice(0, 3)
          .map((slot) => slot.details)
      ).toEqual(['failed', 'failed', 'failed'])
    )
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(f.getDetails).toHaveBeenCalledOnce()
    expect(f.lifetime.snapshot().slots[1].selected).toMatchObject({ characterName: '다라' })
  })

  it('후보 검색이 호출 제한을 받으면 이름과 서버를 정한 슬롯의 상세도 받지 않는다', async () => {
    const f = fixture()
    await f.identify(0)
    await f.identify(1)

    f.rejectSearch(2, new SearchHttpFailure('SEARCH_RATE_LIMITED'))

    await vi.waitFor(() => expect(f.lifetime.snapshot().slots[2].state).toBe('failure'))
    expect(
      f.lifetime
        .snapshot()
        .slots.slice(0, 2)
        .map((slot) => slot.details)
    ).toEqual(['failed', 'failed'])
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(f.getDetails).not.toHaveBeenCalled()
  })

  it('게임 창을 바꾸면 이전 창에서 정한 슬롯의 상세를 취소하고 남은 상세도 받지 않는다', async () => {
    const f = fixture()
    await f.identify(0)
    await f.identify(1)
    await f.identify(2)
    await vi.waitFor(() => expect(f.loads).toHaveLength(1))

    f.lifetime.cancelOcrRequests()

    expect(f.loads[0].signal.aborted).toBe(true)
    expect(
      f.lifetime
        .snapshot()
        .slots.slice(0, 3)
        .map((slot) => slot.details)
    ).toEqual(['failed', 'failed', 'failed'])
    expect(f.lifetime.snapshot().slots[0].selected).toMatchObject({ characterName: '가나' })
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(f.getDetails).toHaveBeenCalledOnce()
  })

  it('회차가 끝나면 받는 중인 상세를 취소하고 남은 상세를 받지 않는다', async () => {
    const f = fixture()
    await f.identify(0)
    await f.identify(1)
    await f.identify(2)
    await vi.waitFor(() => expect(f.loads).toHaveLength(1))

    f.lifetime.end(f.captureId)
    f.loads[0].resolve()
    await new Promise<void>((resolve) => setImmediate(resolve))

    expect(f.loads[0].signal.aborted).toBe(true)
    expect(f.getDetails).toHaveBeenCalledOnce()
    expect(f.lifetime.snapshot().slots.every((slot) => slot.state === 'idle')).toBe(true)
  })

  it('받는 중인 슬롯에 검색할 수 없는 새 관측이 오면 그 상세를 취소하고 다음 슬롯으로 넘어간다', async () => {
    const f = fixture()
    await f.identify(0)
    await f.identify(1)
    await f.identify(2)
    await vi.waitFor(() => expect(f.loads).toHaveLength(1))

    f.lifetime.observeOcr({
      captureId: f.captureId,
      slot: 0,
      observationRevision: 2,
      nickname: '',
      candidateNicknames: [''],
      portrait: null
    })

    expect(f.loads[0].signal.aborted).toBe(true)
    await vi.waitFor(() =>
      expect(f.loads.map(({ characterId }) => characterId)).toEqual(['id-가나', 'id-다라'])
    )
  })

  it('받는 중인 슬롯을 새 이름으로 다시 조회하면 그 상세를 취소하고 새 식별이 끝날 때까지 기다린다', async () => {
    const f = fixture()
    await f.identify(0)
    await f.identify(1)
    await f.identify(2)
    await vi.waitFor(() => expect(f.loads).toHaveLength(1))
    const search = deferred<CharacterCandidate[]>()
    f.candidates.mockReturnValueOnce(search.promise)

    f.lifetime.observeOcr({
      captureId: f.captureId,
      slot: 0,
      observationRevision: 2,
      nickname: '사아',
      candidateNicknames: ['사아'],
      portrait: null
    })

    expect(f.loads[0].signal.aborted).toBe(true)
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(f.loads).toHaveLength(1)
    search.resolve([candidate('사아')])
    await vi.waitFor(() =>
      expect(f.loads.map(({ characterId }) => characterId)).toEqual(['id-가나', 'id-사아'])
    )
  })

  it('서버를 고른 직접 조회는 기다리지 않고 같은 요청에서 상세까지 채운다', async () => {
    const f = fixture()
    f.candidates.mockResolvedValueOnce([candidate('사아')])
    f.getDetails.mockImplementation(async ({ characterId }) => details(characterId))
    f.lifetime.lookup({
      captureId: f.captureId,
      slot: 3,
      observationRevision: 1,
      nickname: '사아',
      serverId: 'cain'
    })

    await vi.waitFor(() => expect(f.lifetime.snapshot().slots[3].state).toBe('success'))
    expect(f.lifetime.snapshot().slots[0].state).toBe('pending')
    expect(f.lifetime.snapshot().slots[3]).not.toHaveProperty('details')
    expect(f.lifetime.snapshot().slots[3].selected).toMatchObject({ level: 115 })
  })

  it('같은 수명의 직접 조회가 끝날 때까지 이름과 서버를 정한 OCR 슬롯의 상세를 받지 않는다', async () => {
    const f = fixture()
    const search = deferred<CharacterCandidate[]>()
    f.candidates.mockReturnValueOnce(search.promise)
    f.lifetime.lookup({
      captureId: f.captureId,
      slot: 3,
      observationRevision: 1,
      nickname: '사아',
      serverId: 'cain'
    })
    await f.identify(0)
    await f.identify(1)
    await f.identify(2)
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(f.getDetails).not.toHaveBeenCalled()

    search.resolve([candidate('사아')])
    await vi.waitFor(() => expect(f.loads).toHaveLength(1))
    expect(f.loads[0].characterId).toBe('id-사아')
    f.loads[0].resolve()

    await vi.waitFor(() =>
      expect(f.loads.map(({ characterId }) => characterId)).toEqual(['id-사아', 'id-가나'])
    )
  })

  it('같은 수명의 직접 조회가 호출 제한을 받으면 OCR 슬롯의 남은 상세도 받지 않는다', async () => {
    const f = fixture()
    const search = deferred<CharacterCandidate[]>()
    f.candidates.mockReturnValueOnce(search.promise)
    f.lifetime.lookup({
      captureId: f.captureId,
      slot: 3,
      observationRevision: 1,
      nickname: '사아',
      serverId: 'cain'
    })
    await f.identify(0)
    await f.identify(1)
    await f.identify(2)

    search.reject(new SearchHttpFailure('SEARCH_RATE_LIMITED'))

    await vi.waitFor(() =>
      expect(f.lifetime.snapshot().slots[3].error).toEqual({ code: 'SEARCH_RATE_LIMITED' })
    )
    expect(
      f.lifetime
        .snapshot()
        .slots.slice(0, 3)
        .map((slot) => slot.details)
    ).toEqual(['failed', 'failed', 'failed'])
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(f.getDetails).not.toHaveBeenCalled()
  })
})

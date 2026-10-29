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

type DetailsLoad = {
  characterId: string
  signal: AbortSignal
  resolve: () => void
  reject: (error: Error) => void
}

function fixture() {
  const searches = new Map(NAMES.map((name) => [name, deferred<CharacterCandidate[]>()]))
  const candidates: MockedFunction<CharacterCandidatesHttp> = vi.fn(
    ({ nickname }) => searches.get(nickname)!.promise
  )
  const loads: DetailsLoad[] = []
  const getDetails: MockedFunction<CharacterDetailsHttp> = vi.fn(
    ({ characterId, signal }) =>
      new Promise<CharacterDetails>((resolve, reject) => {
        loads.push({ characterId, signal, resolve: () => resolve(details(characterId)), reject })
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
      score: () => null
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
  const identifyAll = async () => {
    for (const slot of NAMES.keys()) {
      await identify(slot)
    }
  }

  const rejectSearch = (slot: number, error: Error) => searches.get(NAMES[slot])!.reject(error)
  const load = (name: string) => loads.find(({ characterId }) => characterId === `id-${name}`)!
  const loadedIds = () => loads.map(({ characterId }) => characterId).sort()
  const reobserve = (slot: number, nickname: string) => {
    const search = deferred<CharacterCandidate[]>()
    candidates.mockReturnValueOnce(search.promise)
    lifetime.observeOcr({
      captureId,
      slot,
      observationRevision: 2,
      nickname,
      candidateNicknames: [nickname],
      portrait: null
    })

    return search
  }
  const ocrDetails = () =>
    lifetime
      .snapshot()
      .slots.slice(0, NAMES.length)
      .map((slot) => slot.details)

  return {
    lifetime,
    captureId,
    candidates,
    getDetails,
    loads,
    identify,
    identifyAll,
    rejectSearch,
    load,
    loadedIds,
    reobserve,
    ocrDetails
  }
}

const settle = () => new Promise<void>((resolve) => setImmediate(resolve))

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

    await vi.waitFor(() => expect(f.loadedIds()).toEqual(['id-가나', 'id-다라', 'id-마바']))
  })

  it('이름과 서버를 모두 정하면 상세를 한꺼번에 받고 먼저 받은 슬롯부터 요약을 채운다', async () => {
    const f = fixture()
    await f.identify(2)
    await f.identify(0)
    await f.identify(1)
    await vi.waitFor(() => expect(f.loads).toHaveLength(3))

    f.load('마바').resolve()

    await vi.waitFor(() => expect(f.lifetime.snapshot().slots[2]).not.toHaveProperty('details'))
    expect(f.lifetime.snapshot().slots[2].selected).toMatchObject({
      level: 115,
      guildName: '합성길드'
    })
    expect(f.ocrDetails()).toEqual(['pending', 'pending', undefined])
    f.load('가나').resolve()
    f.load('다라').resolve()
    await vi.waitFor(() => expect(f.ocrDetails()).toEqual([undefined, undefined, undefined]))
    expect(f.getDetails).toHaveBeenCalledTimes(3)
  })

  it('상세를 받지 못하면 고른 이름과 서버는 두고 그 슬롯만 실패로 표시하며 다른 슬롯의 상세는 그대로 반영한다', async () => {
    const f = fixture()
    await f.identifyAll()
    await vi.waitFor(() => expect(f.loads).toHaveLength(3))

    f.load('가나').reject(new SearchHttpFailure('NEOPLE_API_ERROR'))

    await vi.waitFor(() => expect(f.lifetime.snapshot().slots[0].details).toBe('failed'))
    expect(f.lifetime.snapshot().slots[0]).toMatchObject({
      state: 'success',
      error: null,
      selected: { characterName: '가나', card: null }
    })
    f.load('다라').resolve()
    f.load('마바').resolve()
    await vi.waitFor(() => expect(f.ocrDetails()).toEqual(['failed', undefined, undefined]))
  })

  it('상세가 호출 제한을 받아도 이미 받는 중인 다른 슬롯의 상세는 취소하지 않고 끝까지 반영한다', async () => {
    const f = fixture()
    await f.identifyAll()
    await vi.waitFor(() => expect(f.loads).toHaveLength(3))

    f.load('가나').reject(new SearchHttpFailure('SEARCH_RATE_LIMITED'))

    await vi.waitFor(() => expect(f.lifetime.snapshot().slots[0].details).toBe('failed'))
    expect(f.load('다라').signal.aborted).toBe(false)
    expect(f.load('마바').signal.aborted).toBe(false)
    expect(f.ocrDetails()).toEqual(['failed', 'pending', 'pending'])
    f.load('다라').resolve()
    f.load('마바').resolve()
    await vi.waitFor(() => expect(f.ocrDetails()).toEqual(['failed', undefined, undefined]))
    expect(f.lifetime.snapshot().slots[1].selected).toMatchObject({ level: 115 })
  })

  it('상세가 호출 제한을 받으면 아직 시작하지 않은 상세는 실패로 두고 요청하지 않는다', async () => {
    const f = fixture()
    await f.identifyAll()
    await vi.waitFor(() => expect(f.loads).toHaveLength(3))
    const secondSearch = f.reobserve(1, '사아')
    f.reobserve(2, '자차')
    secondSearch.resolve([candidate('사아')])
    await vi.waitFor(() => expect(f.lifetime.snapshot().slots[1].details).toBe('pending'))

    f.load('가나').reject(new SearchHttpFailure('SEARCH_RATE_LIMITED'))

    await vi.waitFor(() => expect(f.lifetime.snapshot().slots[1].details).toBe('failed'))
    expect(f.lifetime.snapshot().slots[1].selected).toMatchObject({ characterName: '사아' })
    await settle()
    expect(f.loadedIds()).toEqual(['id-가나', 'id-다라', 'id-마바'])
  })

  it('후보 검색이 호출 제한을 받으면 이름과 서버를 정한 슬롯의 상세도 받지 않는다', async () => {
    const f = fixture()
    await f.identify(0)
    await f.identify(1)

    f.rejectSearch(2, new SearchHttpFailure('SEARCH_RATE_LIMITED'))

    await vi.waitFor(() => expect(f.lifetime.snapshot().slots[2].state).toBe('failure'))
    expect(f.ocrDetails().slice(0, 2)).toEqual(['failed', 'failed'])
    await settle()
    expect(f.getDetails).not.toHaveBeenCalled()
  })

  it('후보 검색이 호출 제한을 받아도 이미 받는 중인 상세는 끝까지 반영한다', async () => {
    const f = fixture()
    await f.identifyAll()
    await vi.waitFor(() => expect(f.loads).toHaveLength(3))
    const search = f.reobserve(2, '사아')

    search.reject(new SearchHttpFailure('SEARCH_RATE_LIMITED'))

    await vi.waitFor(() => expect(f.lifetime.snapshot().slots[2].state).toBe('failure'))
    expect(f.load('가나').signal.aborted).toBe(false)
    expect(f.load('다라').signal.aborted).toBe(false)
    f.load('가나').resolve()
    f.load('다라').resolve()
    await vi.waitFor(() => expect(f.ocrDetails().slice(0, 2)).toEqual([undefined, undefined]))
  })

  it('게임 창을 바꾸면 이전 창에서 정한 슬롯의 받는 중인 상세를 모두 취소하고 실패로 둔다', async () => {
    const f = fixture()
    await f.identifyAll()
    await vi.waitFor(() => expect(f.loads).toHaveLength(3))

    f.lifetime.cancelOcrRequests()

    expect(f.loads.every(({ signal }) => signal.aborted)).toBe(true)
    expect(f.ocrDetails()).toEqual(['failed', 'failed', 'failed'])
    expect(f.lifetime.snapshot().slots[0].selected).toMatchObject({ characterName: '가나' })
    await settle()
    expect(f.getDetails).toHaveBeenCalledTimes(3)
  })

  it('회차가 끝나면 받는 중인 상세를 모두 취소한다', async () => {
    const f = fixture()
    await f.identifyAll()
    await vi.waitFor(() => expect(f.loads).toHaveLength(3))

    f.lifetime.end(f.captureId)
    f.load('가나').resolve()
    await settle()

    expect(f.loads.every(({ signal }) => signal.aborted)).toBe(true)
    expect(f.getDetails).toHaveBeenCalledTimes(3)
    expect(f.lifetime.snapshot().slots.every((slot) => slot.state === 'idle')).toBe(true)
  })

  it('받는 중인 슬롯에 검색할 수 없는 새 관측이 오면 그 슬롯의 상세만 취소한다', async () => {
    const f = fixture()
    await f.identifyAll()
    await vi.waitFor(() => expect(f.loads).toHaveLength(3))

    f.lifetime.observeOcr({
      captureId: f.captureId,
      slot: 0,
      observationRevision: 2,
      nickname: '',
      candidateNicknames: [''],
      portrait: null
    })

    expect(f.load('가나').signal.aborted).toBe(true)
    expect(f.load('다라').signal.aborted).toBe(false)
    expect(f.load('마바').signal.aborted).toBe(false)
    f.load('다라').resolve()
    await vi.waitFor(() => expect(f.lifetime.snapshot().slots[1]).not.toHaveProperty('details'))
    expect(f.getDetails).toHaveBeenCalledTimes(3)
  })

  it('받는 중인 슬롯을 새 이름으로 다시 조회하면 그 상세만 취소하고 새 식별이 끝나면 새 상세를 받는다', async () => {
    const f = fixture()
    await f.identifyAll()
    await vi.waitFor(() => expect(f.loads).toHaveLength(3))

    const search = f.reobserve(0, '사아')

    expect(f.load('가나').signal.aborted).toBe(true)
    expect(f.load('다라').signal.aborted).toBe(false)
    await settle()
    expect(f.loads).toHaveLength(3)
    search.resolve([candidate('사아')])
    await vi.waitFor(() =>
      expect(f.loadedIds()).toEqual(['id-가나', 'id-다라', 'id-마바', 'id-사아'])
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
    await f.identifyAll()
    await settle()
    expect(f.getDetails).not.toHaveBeenCalled()

    search.resolve([candidate('사아')])
    await vi.waitFor(() => expect(f.loads).toHaveLength(1))
    expect(f.loads[0].characterId).toBe('id-사아')
    f.loads[0].resolve()

    await vi.waitFor(() =>
      expect(f.loadedIds()).toEqual(['id-가나', 'id-다라', 'id-마바', 'id-사아'])
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
    await f.identifyAll()

    search.reject(new SearchHttpFailure('SEARCH_RATE_LIMITED'))

    await vi.waitFor(() =>
      expect(f.lifetime.snapshot().slots[3].error).toEqual({ code: 'SEARCH_RATE_LIMITED' })
    )
    expect(f.ocrDetails()).toEqual(['failed', 'failed', 'failed'])
    await settle()
    expect(f.getDetails).not.toHaveBeenCalled()
  })
})

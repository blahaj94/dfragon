import { describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'
import type { CharacterCandidate, CharacterDetails } from '../../preload/common/types/character'
import type { RaidRowObservation } from '../../preload/common/types/search'
import { FakeClock, deferred } from '../auth/auth-test-fixtures'
import { runSearchRequest } from './request'
import type { CharacterCandidatesHttp, CharacterDetailsHttp } from './character-http'
import { SearchHttpFailure } from './http'
import type { ScoreEngine, ScoreEngineResult } from '../score/engine'
import { dealerCard } from '../../preload/common/search/card-test-fixture'
import { INITIAL_PORTRAIT_COLOR_POLICY } from './portrait-policy'

vi.mock('electron', () => ({ session: { fromPartition: vi.fn() } }))

// 합성 후보, 직업명, 점수만 쓰며 표본이나 플레이어 식별자는 넣지 않는다.
function candidate(
  id: string,
  fame: number | null,
  jobGrowName: string | null = '眞 크루세이더'
): CharacterCandidate {
  return {
    characterId: id,
    characterName: '공대원',
    serverId: 'cain',
    serverName: '카인',
    fame,
    imageUrl: `https://img-api.neople.co.kr/df/servers/cain/characters/${id}?zoom=1`,
    adventureName: null,
    jobName: null,
    jobGrowName
  }
}

function details(characterId: string): CharacterDetails {
  return {
    character: { characterId, serverId: 'cain', serverName: '카인', characterName: '공대원' },
    status: { status: null, buff: null },
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
    },
    card: dealerCard as CharacterDetails['card']
  }
}

function engineResult(score: number | null): ScoreEngineResult {
  const skipped = score === null ? { kind: 'resolution', message: '계산 범위 밖' } : null

  return {
    calculator: 'equipment',
    score,
    skipped,
    approximate_score: null,
    approximate_source: null,
    warning: null,
    versions: { package: '0.1.0', rules_rev: 'rev12', bundle_id: 'phase31-rev12' },
    display: { role: 'dealer', switchingLevel: null, buff30: null, buff50: null }
  }
}

const SCORE_ROW: RaidRowObservation = {
  jobText: '眞크루세이더',
  valueColumn: 'equipment-score',
  valueText: '50,000'
}

/** 같은 직업 동명 후보 넷(명성 순 first, second, third, fourth)과 다른 직업 후보 하나 */
function fixture(engineScores: Record<string, number | null> | null) {
  const clock = new FakeClock()
  const controller = new AbortController()
  const calls: string[] = []
  const candidates: MockedFunction<CharacterCandidatesHttp> = vi.fn(async () => [
    candidate('fourth', 60_000),
    candidate('other-job', 99_000, '眞 데몬슬레이어'),
    candidate('first', 90_000),
    candidate('third', 70_000),
    candidate('second', 80_000)
  ])
  const getDetails: MockedFunction<CharacterDetailsHttp> = vi.fn(async ({ characterId }) => {
    calls.push(`details:${characterId}`)

    return details(characterId)
  })
  const score: MockedFunction<ScoreEngine> = vi.fn((input) => {
    // 엔진 입력의 각 문서에는 상세 응답의 머리가 복원돼 있다.
    const id = String(input.status.characterId)

    return engineResult(engineScores?.[id] ?? null)
  })
  const request = (
    raidRow: RaidRowObservation = SCORE_ROW,
    isCurrent: () => boolean = () => true
  ) =>
    runSearchRequest({
      runtime: {
        clock,
        http: vi.fn(),
        identification: {
          candidates,
          image: vi.fn(),
          details: getDetails,
          scorePortrait: vi.fn(),
          selection: INITIAL_PORTRAIT_COLOR_POLICY
        },
        ocrIdentification: 'raid',
        ...(engineScores === null ? {} : { score })
      },
      nickname: '공대원',
      startedAt: clock.monotonicMs,
      signal: controller.signal,
      isCurrent,
      ocrInput: { candidateNicknames: ['공대원'], portrait: null, raidRow }
    })

  return { clock, controller, calls, candidates, getDetails, score, request }
}

describe('공대 장비 점수 비교의 상세 조회', () => {
  it('직업명 그룹의 명성 상위 3명만 한 명씩 조회하고 고른 후보의 상세는 다시 조회하지 않는다', async () => {
    const f = fixture({ first: 80_000, second: 50_100, third: 20_000 })
    const firstDetails = deferred<CharacterDetails>()
    f.getDetails.mockImplementationOnce(async ({ characterId }) => {
      f.calls.push(`details:${characterId}`)

      return firstDetails.promise
    })

    const pending = f.request()
    await vi.waitFor(() => expect(f.calls).toEqual(['details:first']))
    // 앞 후보의 상세가 끝나기 전에는 다음 후보를 조회하지 않는다.
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(f.calls).toEqual(['details:first'])
    firstDetails.resolve(details('first'))

    expect(await pending).toMatchObject({
      kind: 'success',
      rows: [expect.objectContaining({ characterId: 'second' })],
      selected: { selectionMethod: 'equipment-score', details: details('second') }
    })
    expect(f.calls).toEqual(['details:first', 'details:second', 'details:third'])
  })

  it('상세 429와 엔진이 계산하지 못한 후보는 점수 없음으로 두고 나머지로 고른 뒤 추정으로 표시한다', async () => {
    // first는 상세 429, third는 엔진이 계산하지 못한 후보다.
    const f = fixture({ second: 50_000, third: null })
    f.getDetails.mockImplementationOnce(async ({ characterId }) => {
      f.calls.push(`details:${characterId}`)
      throw new SearchHttpFailure('SEARCH_RATE_LIMITED', {
        retryAfterSeconds: 30,
        retryAfterReceivedAt: 0
      })
    })

    const outcome = await f.request()

    expect(outcome).toMatchObject({
      kind: 'success',
      selected: { selectionMethod: 'equipment-score', details: details('second') }
    })
    expect(
      outcome?.kind === 'success' && outcome.selected?.choices?.map((choice) => choice.characterId)
    ).toEqual(['first', 'second', 'third', 'fourth'])
    expect(
      outcome?.kind === 'success' &&
        outcome.selected?.choices?.every((choice) => choice.face === null)
    ).toBe(true)
    expect(f.calls).toEqual(['details:first', 'details:second', 'details:third'])
  })

  it('점수를 하나도 얻지 못하면 그룹 안 최고 명성 후보를 고르고 이미 받은 상세를 쓴다', async () => {
    const f = fixture(null)

    expect(await f.request()).toMatchObject({
      kind: 'success',
      selected: { selectionMethod: 'highest-fame', details: details('first') }
    })
    expect(f.calls).toEqual(['details:first', 'details:second', 'details:third'])
  })

  it('429로 상세를 받지 못한 후보를 고르면 그 후보의 상세를 한 번 더 조회한다', async () => {
    const f = fixture(null)
    f.getDetails.mockImplementationOnce(async () => {
      throw new SearchHttpFailure('SEARCH_RATE_LIMITED', {
        retryAfterSeconds: 30,
        retryAfterReceivedAt: 0
      })
    })

    expect(await f.request()).toMatchObject({
      kind: 'success',
      selected: { selectionMethod: 'highest-fame', details: details('first') }
    })
    expect(f.calls).toEqual(['details:second', 'details:third', 'details:first'])
  })

  it('429가 아닌 상세 실패는 그 요청을 실패로 끝낸다', async () => {
    const f = fixture({ first: 50_000 })
    f.getDetails.mockRejectedValueOnce(new SearchHttpFailure('NEOPLE_API_ERROR'))

    expect(await f.request()).toMatchObject({
      kind: 'failure',
      error: { code: 'NEOPLE_API_ERROR' }
    })
    expect(f.getDetails).toHaveBeenCalledOnce()
  })
})

describe('공대 식별의 비교 종류', () => {
  it('후보가 없으면 상세를 조회하지 않고 빈 결과로 끝낸다', async () => {
    const f = fixture({})
    f.candidates.mockResolvedValueOnce([])

    expect(await f.request()).toEqual({ kind: 'success', rows: [] })
    expect(f.getDetails).not.toHaveBeenCalled()
  })

  it('직업명이 맞는 후보가 한 명이면 상세를 그 후보만 조회하고 직업명으로 확정한다', async () => {
    const f = fixture({})

    expect(
      await f.request({ jobText: '眞데몬슬레이', valueColumn: 'equipment-score', valueText: '1' })
    ).toMatchObject({
      kind: 'success',
      selected: { selectionMethod: 'job', details: details('other-job') }
    })
    expect(f.calls).toEqual(['details:other-job'])
  })

  it('명성 열은 상세 없이 후보 명성으로 고르고 고른 후보의 상세만 조회한다', async () => {
    const f = fixture({})

    const outcome = await f.request({
      jobText: '眞크루세이더',
      valueColumn: 'fame',
      valueText: '80,000'
    })

    expect(outcome).toMatchObject({
      kind: 'success',
      selected: { selectionMethod: 'fame', details: details('second') }
    })
    expect(outcome?.kind === 'success' && outcome.selected?.choices).toBeUndefined()
    expect(f.calls).toEqual(['details:second'])
  })

  it('이전 API가 직업명을 보내지 않으면 동명 후보 전체를 명성으로 비교한다', async () => {
    const f = fixture({})
    f.candidates.mockResolvedValueOnce([
      candidate('legacy-high', 99_000, null),
      candidate('legacy-low', 50_000, null)
    ])

    expect(
      await f.request({ jobText: '眞크루세이더', valueColumn: 'fame', valueText: '50,000' })
    ).toMatchObject({
      kind: 'success',
      selected: { selectionMethod: 'fame', details: details('legacy-low') }
    })
  })
})

describe('공대 식별의 취소, 만료, 늦은 결과', () => {
  it('비교 대상 상세를 기다리는 중 캡처가 끝나면 다음 후보와 고른 후보를 조회하지 않는다', async () => {
    const f = fixture({ first: 50_000 })
    const pendingDetails = deferred<CharacterDetails>()
    f.getDetails.mockReturnValueOnce(pendingDetails.promise)
    const pending = f.request()
    await vi.waitFor(() => expect(f.getDetails).toHaveBeenCalledOnce())
    const signal = f.getDetails.mock.calls[0][0].signal

    f.controller.abort()

    expect(await pending).toBeNull()
    expect(signal.aborted).toBe(true)
    pendingDetails.resolve(details('first'))
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(f.getDetails).toHaveBeenCalledOnce()
    expect(f.score).not.toHaveBeenCalled()
  })

  it('비교 대상 상세에서 15초 경계에 닿으면 점수를 계산하지 않고 다음 상세도 조회하지 않는다', async () => {
    const f = fixture({ first: 50_000 })
    f.getDetails.mockImplementationOnce(async ({ characterId }) => {
      f.clock.elapseWithoutTimers(15_000)

      return details(characterId)
    })

    expect(await f.request()).toMatchObject({
      kind: 'failure',
      error: { code: 'SEARCH_TIMEOUT' }
    })
    expect(f.getDetails).toHaveBeenCalledOnce()
    expect(f.score).not.toHaveBeenCalled()
  })

  it('응답 없는 비교 대상 상세도 처음 접수한 시각의 15초에 종료한다', async () => {
    const f = fixture({ first: 50_000 })
    f.getDetails.mockReturnValueOnce(new Promise(() => undefined))
    const pending = f.request()
    await vi.waitFor(() => expect(f.getDetails).toHaveBeenCalledOnce())

    f.clock.advance(15_000)

    expect(await pending).toMatchObject({ kind: 'failure', error: { code: 'SEARCH_TIMEOUT' } })
    expect(f.getDetails.mock.calls[0][0].signal.aborted).toBe(true)
  })

  it('비교 중 이전 관측이 되면 429로 끝난 후보 뒤에도 비교를 이어 가지 않는다', async () => {
    const f = fixture({ first: 50_000 })
    let current = true
    f.getDetails.mockImplementationOnce(async () => {
      current = false
      throw new SearchHttpFailure('SEARCH_RATE_LIMITED', {
        retryAfterSeconds: 30,
        retryAfterReceivedAt: 0
      })
    })

    expect(await f.request(SCORE_ROW, () => current)).toBeNull()
    expect(f.getDetails).toHaveBeenCalledOnce()
  })
})

it.each([[['']], [[' 공대원']], [['가', '나', '다']]])(
  '검색할 수 없는 첫 이름 %j는 후보 검색 전에 거절한다',
  async (nicknames) => {
    const f = fixture({})
    const outcome = await runSearchRequest({
      runtime: {
        clock: f.clock,
        http: vi.fn(),
        identification: {
          candidates: f.candidates,
          image: vi.fn(),
          details: f.getDetails,
          scorePortrait: vi.fn(),
          selection: INITIAL_PORTRAIT_COLOR_POLICY
        },
        ocrIdentification: 'raid'
      },
      nickname: nicknames[0],
      startedAt: f.clock.monotonicMs,
      signal: f.controller.signal,
      isCurrent: () => true,
      ocrInput: { candidateNicknames: nicknames, portrait: null, raidRow: SCORE_ROW }
    })

    expect(outcome).toMatchObject({ kind: 'failure', error: { code: 'INVALID_SEARCH_QUERY' } })
    expect(f.candidates).not.toHaveBeenCalled()
  }
)

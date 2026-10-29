import { describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'
import type { CharacterCandidate, CharacterDetails } from '../../preload/common/types/character'
import type { RaidRowObservation } from '../../preload/common/types/search'
import { deferred } from '../lib/async-test-fixture'
import { runDetailsRequest, runSearchRequest } from './request'
import type { CharacterCandidatesHttp, CharacterDetailsHttp } from './character-http'
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

function fixture(engineScores: Record<string, number | null>) {
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
  const score: MockedFunction<ScoreEngine['calculate']> = vi.fn(async (input) => {
    const id = String(input.status.characterId)

    return engineResult(engineScores[id] ?? null)
  })
  const runtime = () => ({
    identification: {
      candidates,
      image: vi.fn(),
      details: getDetails,
      scorePortrait: vi.fn(),
      selection: INITIAL_PORTRAIT_COLOR_POLICY
    },
    ocrIdentification: 'raid' as const,
    scoreEngine: { calculate: score, prepare: vi.fn() }
  })
  const request = (
    raidRow: RaidRowObservation = SCORE_ROW,
    isCurrent: () => boolean = () => true
  ) =>
    runSearchRequest({
      runtime: runtime(),
      nickname: '공대원',
      signal: controller.signal,
      isCurrent,
      ocrInput: { candidateNicknames: ['공대원'], portrait: null, raidRow }
    })
  const loadDetails = async (isCurrent: () => boolean = () => true) => {
    const identified = await request()
    if (identified?.kind !== 'success' || identified.selected === undefined) {
      throw new Error('식별 결과가 없습니다')
    }

    return runDetailsRequest({
      runtime: runtime(),
      summary: identified.selected.summary,
      signal: controller.signal,
      isCurrent
    })
  }

  return { controller, calls, candidates, getDetails, score, request, loadDetails }
}

describe('공대 장비 점수 열의 식별', () => {
  it('상세 없이 직업명 그룹의 최고 명성 후보를 고르고 그룹 후보를 함께 반환한다', async () => {
    const f = fixture({ first: 80_000, second: 50_000 })
    const result = await f.request()

    expect(f.calls).toEqual([])
    expect(result).toMatchObject({
      kind: 'success',
      selected: {
        selectionMethod: 'highest-fame',
        details: 'pending',
        summary: { characterId: 'first', fame: 90_000, level: null, card: null }
      }
    })
    if (result?.kind === 'success') {
      expect(result.selected?.choices?.map((choice) => choice.characterId)).toEqual([
        'first',
        'second',
        'third',
        'fourth'
      ])
    }
  })
})

describe('공대 식별의 비교 종류', () => {
  it('후보가 없으면 상세를 조회하지 않고 빈 결과로 끝낸다', async () => {
    const f = fixture({})
    f.candidates.mockResolvedValueOnce([])

    expect(await f.request()).toEqual({ kind: 'success', rows: [] })
    expect(f.getDetails).not.toHaveBeenCalled()
  })

  it('직업명이 맞는 후보가 한 명이면 상세 없이 직업명으로 확정한다', async () => {
    const f = fixture({})

    expect(
      await f.request({ jobText: '眞데몬슬레이', valueColumn: 'equipment-score', valueText: '1' })
    ).toMatchObject({
      kind: 'success',
      selected: { selectionMethod: 'job', summary: { characterId: 'other-job' } }
    })
    expect(f.calls).toEqual([])
  })

  it('명성 열은 상세 없이 후보 명성으로 고른다', async () => {
    const f = fixture({})

    const outcome = await f.request({
      jobText: '眞크루세이더',
      valueColumn: 'fame',
      valueText: '80,000'
    })

    expect(outcome).toMatchObject({
      kind: 'success',
      selected: { selectionMethod: 'fame', summary: { characterId: 'second' } }
    })
    expect(outcome?.kind === 'success' && outcome.selected?.choices).toBeUndefined()
    expect(f.calls).toEqual([])
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
      selected: { selectionMethod: 'fame', summary: { characterId: 'legacy-low' } }
    })
  })
})

describe('고른 공대원의 상세 조회', () => {
  it('고른 후보의 상세로 레벨과 카드 점수를 채운다', async () => {
    const f = fixture({ first: 50_000 })

    expect(await f.loadDetails()).toMatchObject({
      kind: 'success',
      summary: { characterId: 'first', equipmentScore: 50_000, card: { role: 'dealer' } }
    })
    expect(f.calls).toEqual(['details:first'])
  })

  it('고른 후보의 상세를 기다리는 중 캡처가 끝나면 늦은 결과를 반영하지 않는다', async () => {
    const f = fixture({ first: 50_000 })
    // 취소를 무시하고 늦게 끝나는 의존성이다.
    const pendingDetails = deferred<CharacterDetails>()
    f.getDetails.mockReturnValueOnce(pendingDetails.promise)
    const pending = f.loadDetails()
    await vi.waitFor(() => expect(f.getDetails).toHaveBeenCalledOnce())
    const signal = f.getDetails.mock.calls[0][0].signal

    f.controller.abort()
    pendingDetails.resolve(details('first'))

    expect(await pending).toBeNull()
    expect(signal.aborted).toBe(true)
    expect(f.getDetails).toHaveBeenCalledOnce()
    expect(f.score).not.toHaveBeenCalled()
  })
})

it.each([[['']], [[' 공대원']], [['가', '나', '다']]])(
  '검색할 수 없는 첫 이름 %j는 후보 검색 전에 거절한다',
  async (nicknames) => {
    const f = fixture({})
    const outcome = await runSearchRequest({
      runtime: {
        identification: {
          candidates: f.candidates,
          image: vi.fn(),
          details: f.getDetails,
          scorePortrait: vi.fn(),
          selection: INITIAL_PORTRAIT_COLOR_POLICY
        },
        ocrIdentification: 'raid',
        scoreEngine: { calculate: f.score, prepare: vi.fn() }
      },
      nickname: nicknames[0],
      signal: f.controller.signal,
      isCurrent: () => true,
      ocrInput: { candidateNicknames: nicknames, portrait: null, raidRow: SCORE_ROW }
    })

    expect(outcome).toMatchObject({ kind: 'failure', error: { code: 'INVALID_SEARCH_QUERY' } })
    expect(f.candidates).not.toHaveBeenCalled()
  }
)

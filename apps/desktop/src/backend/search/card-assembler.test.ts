import { describe, expect, it, vi } from 'vitest'
import { bufferCard, dealerCard } from '../../preload/common/search/card-test-fixture'
import { parseSearchSnapshot } from '../../preload/common/search/snapshot'
import { searchRow, searchSlot, withSearchSlot } from '../../preload/api/search-test-fixture'
import type { CharacterDetails } from '../../preload/common/types/character'
import { apiDetailsFromEngineInput, readEngineInput } from '../score/details-test-fixture'
import type { ScoreEngine, ScoreEngineResult } from '../score/engine'
import { toScoreEngineInput } from '../score/input'
import { buildCharacterCard } from './card-assembler'

const versions = { package: '0.1.0', rules_rev: 'rev12', bundle_id: 'phase31-rev12' }
const dealerResult: ScoreEngineResult = {
  calculator: 'equipment',
  score: 1741,
  skipped: null,
  approximate_score: null,
  approximate_source: null,
  warning: null,
  versions,
  display: { role: 'dealer', switchingLevel: 3, buff30: null, buff50: null }
}
const bufferResult: ScoreEngineResult = {
  calculator: 'buff',
  score: 136617,
  skipped: null,
  approximate_score: null,
  approximate_source: null,
  warning: null,
  versions,
  display: { role: 'buffer', switchingLevel: 2, buff30: 1874.5, buff50: 622 }
}

const selected = {
  ...searchRow,
  fame: 0,
  level: null,
  adventureName: null,
  jobName: null,
  jobGrowName: null,
  imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/synthetic-character?zoom=1',
  guildName: null,
  equipmentScore: null
}

function acceptsCard(card: unknown): boolean {
  const snapshot = withSearchSlot(
    searchSlot({ state: 'success', rows: [searchRow], selected: { ...selected, card } as never })
  )

  return parseSearchSnapshot(snapshot) !== null
}

describe('API 카드와 엔진 결과 조립', () => {
  it('딜러 카드는 equipment 계산기로 상세 응답의 엔진 입력을 넘기고 점수를 채운다', () => {
    const details = apiDetailsFromEngineInput(readEngineInput('dealer-blade'), dealerCard)
    const score = vi.fn<ScoreEngine>(() => dealerResult)

    const card = buildCharacterCard(details, score)

    expect(score).toHaveBeenCalledExactlyOnceWith(toScoreEngineInput(details), 'equipment')
    expect(card).toEqual({
      role: 'dealer',
      score: {
        calculator: 'equipment',
        value: 1741,
        skipped: null,
        approximate: null,
        versions: { package: '0.1.0', rulesRev: 'rev12', bundleId: 'phase31-rev12' }
      }
    })
    expect(acceptsCard(card)).toBe(true)
  })

  it('버퍼 카드는 buff 계산기로 부르고 점수를 채운다', () => {
    const details = apiDetailsFromEngineInput(readEngineInput('buffer-muse'), bufferCard)
    const score = vi.fn<ScoreEngine>(() => bufferResult)

    const card = buildCharacterCard(details, score)

    expect(score.mock.calls[0][1]).toBe('buff')
    expect(card).toMatchObject({ role: 'buffer', score: { calculator: 'buff', value: 136617 } })
  })

  it('역할을 모르는 카드는 equipment 계산기로 부른다', () => {
    const details = apiDetailsFromEngineInput(readEngineInput('dealer-blade'), {
      role: null,
      score: null
    })
    const score = vi.fn<ScoreEngine>(() => dealerResult)

    const card = buildCharacterCard(details, score)

    expect(score.mock.calls[0][1]).toBe('equipment')
    expect(card).toMatchObject({ role: null, score: { value: 1741 } })
  })

  it('이전 API가 함께 보낸 스탯, 세트, 서약, 강화 값은 카드에 남기지 않는다', () => {
    const details = apiDetailsFromEngineInput(readEngineInput('dealer-blade'), dealerCard)
    const legacy = {
      ...details,
      card: {
        role: 'dealer',
        stats: { role: 'dealer', attackIncrease: 1, amplification: 2, critical: 3 },
        score: null,
        serverRank: null,
        set: null,
        oath: null,
        investment: []
      }
    } as CharacterDetails

    expect(buildCharacterCard(legacy, () => dealerResult)).toMatchObject({
      role: 'dealer',
      score: { value: 1741 }
    })
    expect(Object.keys(buildCharacterCard(legacy, () => dealerResult)!)).toEqual(['role', 'score'])
  })

  it('건너뛴 결과는 점수 null과 사유를 카드에 남긴다', () => {
    const details = apiDetailsFromEngineInput(readEngineInput('dealer-blade'), dealerCard)
    const skipped = { kind: 'resolution', message: '판정 불가' }
    const score: ScoreEngine = () => ({ ...dealerResult, score: null, skipped })

    expect(buildCharacterCard(details, score)?.score).toMatchObject({
      value: null,
      skipped,
      approximate: null
    })
  })

  it('엔진이 건너뛴 결과에 낸 근사값은 정확한 점수 칸을 비운 채 따로 남긴다', () => {
    const details = apiDetailsFromEngineInput(readEngineInput('dealer-blade'), dealerCard)
    const skipped = { kind: 'unresolved', message: '판정 불가' }
    const warning = '근사값, 1% 밖일 가능성 높음: 판정 불가'
    const score: ScoreEngine = () => ({
      ...dealerResult,
      score: null,
      skipped,
      approximate_score: 1650,
      approximate_source: 'legacy_fusion_policy_a',
      warning
    })

    const card = buildCharacterCard(details, score)

    expect(card?.score).toMatchObject({
      value: null,
      skipped,
      approximate: { value: 1650, source: 'legacy_fusion_policy_a', warning }
    })
    expect(acceptsCard(card)).toBe(true)
  })

  it('정확한 점수에 붙은 경고는 카드에 남기지 않고 점수만 채운다', () => {
    const details = apiDetailsFromEngineInput(readEngineInput('buffer-muse'), bufferCard)
    const score: ScoreEngine = () => ({ ...bufferResult, warning: '아바타가 번들에 없음' })

    const card = buildCharacterCard(details, score)

    expect(card?.score).toMatchObject({ value: 136617, skipped: null, approximate: null })
    expect(acceptsCard(card)).toBe(true)
  })

  it('엔진 실패이면 API가 보낸 점수를 지운다', () => {
    const score: ScoreEngine = () => null
    const apiScore = {
      calculator: 'equipment',
      value: 9999,
      skipped: null,
      approximate: null,
      versions: { package: 'api', rulesRev: 'api', bundleId: 'api' }
    } as const
    const details = apiDetailsFromEngineInput(readEngineInput('buffer-muse'), {
      ...bufferCard,
      score: apiScore
    })

    expect(buildCharacterCard(details, score)).toEqual(bufferCard)
  })

  it.each([
    ['카드 없음', undefined],
    ['역할 누락', { score: null }],
    ['알 수 없는 역할', { ...dealerCard, role: 'tank' }]
  ])('%s 상세 응답은 엔진을 부르지 않고 카드를 null로 둔다', (_name, apiCard) => {
    const { card: _card, ...withoutCard } = apiDetailsFromEngineInput(
      readEngineInput('dealer-blade'),
      null
    )
    const details = apiCard === undefined ? withoutCard : { ...withoutCard, card: apiCard }
    const score = vi.fn<ScoreEngine>(() => dealerResult)

    expect(buildCharacterCard(details as CharacterDetails, score)).toBeNull()
    expect(score).not.toHaveBeenCalled()
  })
})

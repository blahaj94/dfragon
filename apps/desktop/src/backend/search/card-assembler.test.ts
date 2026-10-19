import { describe, expect, it, vi } from 'vitest'
import { bufferCard, dealerCard } from '@dfragon/desktop-contracts/search/card-test-fixture'
import { characterCardSchema } from '@dfragon/desktop-contracts/search/character-summary'
import type { CharacterDetails } from '@dfragon/desktop-contracts/types/character'
import { apiDetailsFromEngineInput, readEngineInput } from '../score/details-test-fixture'
import type { ScoreEngine, ScoreEngineResult } from '../score/engine'
import { toScoreEngineInput } from '../score/input'
import { buildCharacterCard } from './card-assembler'

const versions = { package: '0.1.0', rules_rev: 'rev12', bundle_id: 'phase31-rev12' }
const dealerResult: ScoreEngineResult = {
  calculator: 'equipment',
  score: 1741,
  skipped: null,
  versions,
  display: { role: 'dealer', switchingLevel: 3, buff30: null, buff50: null }
}
const bufferResult: ScoreEngineResult = {
  calculator: 'buff',
  score: 136617,
  skipped: null,
  versions,
  display: { role: 'buffer', switchingLevel: 2, buff30: 1874.5, buff50: 622 }
}

describe('API 카드와 엔진 결과 조립', () => {
  it('딜러 카드는 equipment 계산기로 상세 응답의 엔진 입력을 넘기고 점수와 스위칭 Lv만 채운다', () => {
    const details = apiDetailsFromEngineInput(readEngineInput('dealer-blade'), dealerCard)
    const score = vi.fn<ScoreEngine>(() => dealerResult)

    const card = buildCharacterCard(details, score)

    expect(score).toHaveBeenCalledExactlyOnceWith(toScoreEngineInput(details), 'equipment')
    expect(card).toEqual({
      ...dealerCard,
      stats: { ...dealerCard.stats, switchingLevel: 3 },
      score: {
        calculator: 'equipment',
        value: 1741,
        skipped: null,
        versions: { package: '0.1.0', rulesRev: 'rev12', bundleId: 'phase31-rev12' }
      }
    })
    expect(characterCardSchema.safeParse(card).success).toBe(true)
  })

  it('버퍼 카드는 buff 계산기로 부르고 스위칭 Lv, 30레벨과 50레벨 버프를 채운다', () => {
    const details = apiDetailsFromEngineInput(readEngineInput('buffer-muse'), bufferCard)
    const score = vi.fn<ScoreEngine>(() => bufferResult)

    const card = buildCharacterCard(details, score)

    expect(score.mock.calls[0][1]).toBe('buff')
    expect(card?.stats).toEqual({
      role: 'buffer',
      townIntelligence: 9120,
      buff30: 1874.5,
      buff50: 622,
      switchingLevel: 2
    })
    expect(card?.score?.value).toBe(136617)
  })

  it('역할을 모르는 카드는 equipment 계산기로 부르고 스탯이 없으면 점수만 채운다', () => {
    const unknownRole = { ...dealerCard, role: null, stats: null }
    const details = apiDetailsFromEngineInput(readEngineInput('dealer-blade'), unknownRole)
    const score = vi.fn<ScoreEngine>(() => dealerResult)

    const card = buildCharacterCard(details, score)

    expect(score.mock.calls[0][1]).toBe('equipment')
    expect(card?.stats).toBeNull()
    expect(card?.score?.value).toBe(1741)
  })

  it('엔진 표시 역할이 카드 스탯과 다르면 API가 보낸 중간값도 null로 두고 점수만 둔다', () => {
    const details = apiDetailsFromEngineInput(readEngineInput('dealer-blade'), {
      ...dealerCard,
      stats: {
        role: 'dealer',
        attackIncrease: 34458,
        amplification: 302,
        critical: 117.5,
        switchingLevel: 9
      }
    })
    const score: ScoreEngine = () => ({ ...dealerResult, display: bufferResult.display })

    const card = buildCharacterCard(details, score)

    expect(card?.stats).toEqual(dealerCard.stats)
    expect(card?.score?.value).toBe(1741)
  })

  it('건너뛴 결과는 점수 null과 사유를 카드에 남긴다', () => {
    const details = apiDetailsFromEngineInput(readEngineInput('dealer-blade'), dealerCard)
    const skipped = { kind: 'resolution', message: '판정 불가' }
    const score: ScoreEngine = () => ({ ...dealerResult, score: null, skipped })

    expect(buildCharacterCard(details, score)?.score).toMatchObject({ value: null, skipped })
  })

  it.each([
    ['엔진 없음', null],
    ['엔진 실패', (() => null) satisfies ScoreEngine]
  ])('%s이면 API가 보낸 점수와 중간값도 지우고 나머지 카드는 API 값 그대로다', (_name, score) => {
    // API는 점수와 중간값을 null로 보내지만, 값이 와도 엔진 결과가 아니면 카드에 남기지 않는다.
    const apiScore = {
      calculator: 'equipment',
      value: 9999,
      skipped: null,
      versions: { package: 'api', rulesRev: 'api', bundleId: 'api' }
    } as const
    const details = apiDetailsFromEngineInput(readEngineInput('buffer-muse'), {
      ...bufferCard,
      stats: { role: 'buffer', townIntelligence: 9120, buff30: 1, buff50: 2, switchingLevel: 3 },
      score: apiScore
    })

    expect(buildCharacterCard(details, score)).toEqual(bufferCard)
  })

  it.each([
    ['카드 없음', undefined],
    ['모르는 키', { ...dealerCard, display: { score: '1,741' } }],
    ['문자 스탯', { ...dealerCard, stats: { ...dealerCard.stats, critical: '117.5' } }]
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

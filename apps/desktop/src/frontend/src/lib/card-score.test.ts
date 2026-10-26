import { expect, it } from 'vitest'
import { bufferCard, dealerCard } from '../testing/fixtures/character-cards'
import type { CharacterCard } from '../types/cards'
import { formatApproximateScore, toScoreView } from './card-score'

it('카드 값이 없으면 점수 값 대신 null을 두고 라벨은 장비 점수로 둔다', () => {
  expect(toScoreView(null)).toEqual({
    label: '장비 점수',
    tone: null,
    value: null,
    approximate: false,
    description: undefined
  })
})

it('딜러 카드는 장비 점수를 딜러 톤으로 보이고 계산값임을 보조 기술에 전한다', () => {
  expect(toScoreView(dealerCard)).toEqual({
    label: '장비 점수',
    tone: 'dealer',
    value: 330556,
    approximate: false,
    description: 'DFragon 계산값이라 게임 장비 점수와 조금 다를 수 있습니다.'
  })
})

it('버퍼 카드는 점수 라벨을 버프 점수, 색을 버퍼 톤으로 정한다', () => {
  expect(toScoreView(bufferCard)).toEqual({
    label: '버프 점수',
    tone: 'buffer',
    value: 55358,
    approximate: false,
    description: 'DFragon 계산값이라 게임 버프 점수와 조금 다를 수 있습니다.'
  })
})

it('역할을 모르는 카드는 점수 라벨을 장비 점수로 두고 역할 색을 정하지 않는다', () => {
  expect(toScoreView({ ...dealerCard, role: null })).toMatchObject({
    label: '장비 점수',
    tone: null,
    value: 330556
  })
})

it('점수 값이 없어도 라벨은 역할을 따라 버퍼는 버프 점수로 둔다', () => {
  const missing = { ...bufferCard, score: null }
  expect(toScoreView(missing)).toEqual({
    label: '버프 점수',
    tone: 'buffer',
    value: null,
    approximate: false,
    description: undefined
  })
})

it('엔진이 건너뛴 점수는 값 없이 사유 종류만 전하고 엔진의 원문 메시지는 쓰지 않는다', () => {
  const skipped = (kind: string): CharacterCard => ({
    ...dealerCard,
    score: {
      calculator: 'equipment',
      value: null,
      skipped: { kind, message: 'unresolved: equipment TITLE missing' },
      approximate: null,
      versions: { package: 'dnfscore', rulesRev: 'rev12', bundleId: 'phase31-rev12' }
    }
  })
  expect(toScoreView(skipped('unresolved'))).toEqual({
    label: '장비 점수',
    tone: 'dealer',
    value: null,
    approximate: false,
    description: '계산하지 못함, 장비 정보 부족'
  })
  expect(toScoreView(skipped('input_gate')).description).toBe(
    '계산하지 못함, 입력값이 게임 스탯과 다름'
  )
  const unknown = toScoreView(skipped('new_kind'))
  expect(unknown).toEqual({
    label: '장비 점수',
    tone: 'dealer',
    value: null,
    approximate: false,
    description: '계산하지 못함, 계산 제외'
  })
  expect(unknown.description).not.toContain('TITLE')
  expect(toScoreView(skipped('toString')).description).toBe('계산하지 못함, 계산 제외')
})

it('엔진이 건너뛴 점수에 낸 근사값은 근사값으로 보이고 사유 종류와 근사 방법을 전한다', () => {
  const approximate = (source: string): CharacterCard => ({
    ...dealerCard,
    score: {
      calculator: 'equipment',
      value: null,
      skipped: { kind: 'unresolved', message: 'unresolved: equipment TITLE missing' },
      approximate: {
        value: 321000,
        source,
        warning: '근사값, 1% 밖일 가능성 높음: unresolved: equipment TITLE missing'
      },
      versions: { package: 'dnfscore-native 0.3.0', rulesRev: 'rev14', bundleId: 'phase32-rev14' }
    }
  })
  const legacy = toScoreView(approximate('legacy_fusion_policy_a'))
  expect(legacy).toEqual({
    label: '장비 점수',
    tone: 'dealer',
    value: 321000,
    approximate: true,
    description:
      '근사값, 장비 정보 부족. 이전 시즌 융합석을 빼고 계산한 값이라 게임 장비 점수와 1% 넘게 다를 수 있습니다.'
  })
  expect(legacy.description).not.toContain('TITLE')
  expect(toScoreView(approximate('common_level_skip_computed')).description).toBe(
    '근사값, 장비 정보 부족. 공통 스킬 레벨을 1로 두고 계산한 값이라 게임 장비 점수와 1% 넘게 다를 수 있습니다.'
  )
  expect(toScoreView(approximate('new_source'))).toMatchObject({
    value: 321000,
    approximate: true,
    description:
      '근사값, 장비 정보 부족. 정확히 계산하지 못한 추정값이라 게임 장비 점수와 1% 넘게 다를 수 있습니다.'
  })
})

it('근사값 점수의 화면 글자는 천 단위 구분 앞에 ≈를 붙인다', () => {
  expect(formatApproximateScore(321000)).toBe('≈321,000')
})

import { characterCardSchema } from '@dfragon/desktop-contracts/search/character-summary'
import type {
  CharacterCard,
  CharacterCardStats,
  CharacterDetails,
  CharacterScoreCalculator
} from '@dfragon/desktop-contracts/types/character'
import { toScoreEngineInput } from '../score/input'
import type { ScoreEngine, ScoreEngineResult } from '../score/engine'

/** 역할 판단은 API가 정한 `card.role`을 따르고 엔진에 맡기지 않는다. */
function scoreCalculator(card: CharacterCard): CharacterScoreCalculator {
  if (card.role === 'buffer') {
    return 'buff'
  }

  return 'equipment'
}

/** 엔진의 표시용 중간값 칸. API는 항상 null로 보내고 main이 엔진 결과로만 채운다. */
const NO_ENGINE_STATS = { switchingLevel: null, buff30: null, buff50: null } as const

/**
 * 엔진의 표시용 중간값은 카드 스탯과 역할이 같을 때만 채운다. 엔진 결과가 없거나 역할이 다르면
 * API가 무엇을 보냈든 null로 둔다.
 */
function withEngineStats(
  stats: CharacterCardStats | null,
  display: ScoreEngineResult['display'] | null
): CharacterCardStats | null {
  if (stats === null) {
    return null
  }
  const matched = display !== null && display.role === stats.role
  const values = matched ? display : NO_ENGINE_STATS

  if (stats.role === 'dealer') {
    return { ...stats, switchingLevel: values.switchingLevel }
  }

  return {
    ...stats,
    switchingLevel: values.switchingLevel,
    buff30: values.buff30,
    buff50: values.buff50
  }
}

/** API의 `card`에 엔진 결과를 채운다. 엔진 결과가 없으면 점수와 중간값은 null이고 나머지 카드는 유지한다. */
function assembleCharacterCard(
  card: CharacterCard,
  result: ScoreEngineResult | null
): CharacterCard {
  if (result === null) {
    const stats = withEngineStats(card.stats, null)

    return { ...card, stats, score: null }
  }
  const { versions } = result
  const score = {
    calculator: result.calculator,
    value: result.score,
    skipped: result.skipped,
    versions: {
      package: versions.package,
      rulesRev: versions.rules_rev,
      bundleId: versions.bundle_id
    }
  }
  const stats = withEngineStats(card.stats, result.display)

  return { ...card, stats, score }
}

/**
 * 상세 응답의 `card`를 검증하고 점수를 채운다. 검증에 실패한 카드는 null이며 엔진을 부르지 않는다.
 * 엔진이 없으면 `score`를 null로 둔다.
 */
export function buildCharacterCard(
  details: CharacterDetails,
  score: ScoreEngine | null
): CharacterCard | null {
  const parsed = characterCardSchema.safeParse(details.card)
  if (!parsed.success) {
    return null
  }
  const card = parsed.data
  const result = score === null ? null : score(toScoreEngineInput(details), scoreCalculator(card))

  return assembleCharacterCard(card, result)
}

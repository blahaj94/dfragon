import { apiCharacterCardSchema } from '../../preload/common/search/character-summary'
import type {
  CharacterCard,
  CharacterCardRole,
  CharacterCardScore,
  CharacterDetails,
  CharacterScoreCalculator
} from '../../preload/common/types/character'
import { toScoreEngineInput } from '../score/input'
import type { ScoreEngine, ScoreEngineResult } from '../score/engine'

/** 역할 판단은 API가 정한 `card.role`을 따르고 엔진에 맡기지 않는다. */
function scoreCalculator(role: CharacterCardRole | null): CharacterScoreCalculator {
  if (role === 'buffer') {
    return 'buff'
  }

  return 'equipment'
}

// 엔진 검증이 근사값이 있으면 출처와 경고도 있게 맞췄다. 정확한 점수에 붙는 경고만 있는 결과는 근사값이 없다.
function toApproximateScore(result: ScoreEngineResult): CharacterCardScore['approximate'] {
  const { approximate_score: value, approximate_source: source, warning } = result
  if (value === null || source === null || warning === null) {
    return null
  }

  return { value, source, warning }
}

function toCardScore(result: ScoreEngineResult): CharacterCardScore {
  const { versions } = result

  return {
    calculator: result.calculator,
    value: result.score,
    skipped: result.skipped,
    approximate: toApproximateScore(result),
    versions: {
      package: versions.package,
      rulesRev: versions.rules_rev,
      bundleId: versions.bundle_id
    }
  }
}

/**
 * 상세 응답의 `card`에서 역할을 읽고 점수를 채운다. 역할을 읽지 못한 카드는 null이며 엔진을 부르지 않는다.
 * 엔진이 없으면 `score`를 null로 둔다.
 */
export function buildCharacterCard(
  details: CharacterDetails,
  score: ScoreEngine | null
): CharacterCard | null {
  const parsed = apiCharacterCardSchema.safeParse(details.card)
  if (!parsed.success) {
    return null
  }
  const { role } = parsed.data
  const result = score === null ? null : score(toScoreEngineInput(details), scoreCalculator(role))

  const cardScore = result === null ? null : toCardScore(result)

  return { role, score: cardScore }
}

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

function scoreCalculator(role: CharacterCardRole | null): CharacterScoreCalculator {
  if (role === 'buffer') {
    return 'buff'
  }

  return 'equipment'
}

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

export function buildCharacterCard(
  details: CharacterDetails,
  score: ScoreEngine
): CharacterCard | null {
  const parsed = apiCharacterCardSchema.safeParse(details.card)
  if (!parsed.success) {
    return null
  }
  const { role } = parsed.data
  const result = score(toScoreEngineInput(details), scoreCalculator(role))
  if (result === null) {
    return { role, score: null }
  }

  return { role, score: toCardScore(result) }
}

import { characterCardSchema } from '../../preload/common/search/character-summary'
import type {
  CharacterCard,
  CharacterCardStats,
  CharacterDetails,
  CharacterJsonValue,
  CharacterScoreCalculator
} from '../../preload/common/types/character'
import { isJsonObject, toScoreEngineInput } from '../score/input'
import type { ScoreEngine, ScoreEngineResult } from '../score/engine'

/** 역할 판단은 API가 정한 `card.role`을 따르고 엔진에 맡기지 않는다. */
function scoreCalculator(card: CharacterCard): CharacterScoreCalculator {
  if (card.role === 'buffer') {
    return 'buff'
  }

  return 'equipment'
}

/** 엔진의 버프 수치 칸. API는 항상 null로 보내고 main이 엔진 결과로만 채운다. */
const NO_ENGINE_BUFFS = { buff30: null, buff50: null } as const

function jsonField(
  value: CharacterJsonValue | undefined,
  key: string
): CharacterJsonValue | undefined {
  if (!isJsonObject(value)) {
    return undefined
  }

  return value[key]
}

/**
 * 스위칭 Lv. 버프 강화 장비 응답(`skill/buff/equip/equipment`)의 스위칭 스킬 레벨(`skillInfo.option.level`)로,
 * 스위칭 장비를 입었을 때 장비 옵션까지 더한 레벨이다. 스위칭 장비가 없어 option이 없으면 null이다.
 */
function switchingLevel(details: CharacterDetails): number | null {
  const option = jsonField(jsonField(details.buff.equipment, 'skillInfo'), 'option')
  const level = jsonField(option, 'level')
  if (typeof level !== 'number' || !Number.isFinite(level)) {
    return null
  }

  return level
}

/**
 * 스위칭 Lv은 상세 응답에서 읽고, 버퍼의 버프 수치는 엔진 결과가 카드 스탯과 역할이 같을 때만 채운다. 엔진
 * 결과가 없거나 역할이 다르면 API가 무엇을 보냈든 버프 수치는 null로 둔다.
 */
function withDisplayStats(
  stats: CharacterCardStats | null,
  switching: number | null,
  display: ScoreEngineResult['display'] | null
): CharacterCardStats | null {
  if (stats === null) {
    return null
  }

  if (stats.role === 'dealer') {
    return { ...stats, switchingLevel: switching }
  }
  const matched = display !== null && display.role === stats.role
  const buffs = matched ? display : NO_ENGINE_BUFFS

  return { ...stats, switchingLevel: switching, buff30: buffs.buff30, buff50: buffs.buff50 }
}

/** API의 `card`에 엔진 결과를 채운다. 엔진 결과가 없으면 점수와 중간값은 null이고 나머지 카드는 유지한다. */
function assembleCharacterCard(
  card: CharacterCard,
  switching: number | null,
  result: ScoreEngineResult | null
): CharacterCard {
  if (result === null) {
    const stats = withDisplayStats(card.stats, switching, null)

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
  const stats = withDisplayStats(card.stats, switching, result.display)

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

  return assembleCharacterCard(card, switchingLevel(details), result)
}

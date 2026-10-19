import { isFiniteNumber } from '@dfragon/lib/utils/shape-check'
import type {
  CharacterCard,
  CharacterDetails,
  CharacterJsonValue
} from '../../preload/common/types/character'
import { characterImageUrl } from '../../preload/common/search/character-summary'
import { parseCharacterDetailSnapshot } from '../../preload/common/character-detail'
import type { CharacterDetailSnapshot } from '../../preload/common/types/character-detail'

function optionalText(value: CharacterJsonValue | undefined): string | null {
  if (typeof value === 'string') {
    return value
  }

  return null
}

function optionalNumber(value: CharacterJsonValue | undefined): number | null {
  if (isFiniteNumber(value)) {
    return value
  }

  return null
}

/**
 * 상세 창에 넘길 값을 만든다. 기본 정보는 상세 응답에서, 카드 값은 검색이 메인 카드에 넘긴 값(점수 포함)을
 * 그대로 쓰고 점수를 다시 계산하지 않는다.
 */
export function createCharacterDetailSnapshot(
  details: CharacterDetails,
  card: CharacterCard | null
): CharacterDetailSnapshot {
  const source = details.character
  const adventureName = optionalText(source.adventureName)
  const jobName = optionalText(source.jobName)
  const jobGrowName = optionalText(source.jobGrowName)
  const level = optionalNumber(source.level)
  const fame = optionalNumber(source.fame)
  const guildName = optionalText(source.guildName)
  const imageUrl = characterImageUrl(source)
  const character = {
    serverId: source.serverId,
    characterId: source.characterId,
    characterName: source.characterName,
    serverName: source.serverName,
    adventureName,
    jobName,
    jobGrowName,
    level,
    fame,
    imageUrl,
    guildName
  }
  const freshness = { ...details.freshness }

  return parseCharacterDetailSnapshot({ character, card, freshness })
}

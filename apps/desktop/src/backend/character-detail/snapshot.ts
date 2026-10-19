import type {
  CharacterDetails,
  CharacterJsonValue
} from '@dfragon/desktop-contracts/types/character'
import { characterImageUrl } from '@dfragon/desktop-contracts/search/character-summary'
import { parseCharacterDetailSnapshot } from '@dfragon/desktop-contracts/character-detail'
import type { CharacterDetailSnapshot } from '@dfragon/desktop-contracts/types/character-detail'

function optionalText(value: CharacterJsonValue | undefined): string | null {
  if (typeof value === 'string') {
    return value
  }

  return null
}

function optionalNumber(value: CharacterJsonValue | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return null
}

export function createCharacterDetailSnapshot(details: CharacterDetails): CharacterDetailSnapshot {
  const source = details.character
  const adventureName = optionalText(source.adventureName)
  const jobName = optionalText(source.jobName)
  const jobGrowName = optionalText(source.jobGrowName)
  const level = optionalNumber(source.level)
  const fame = optionalNumber(source.fame)
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
    imageUrl
  }
  const freshness = { ...details.freshness }

  return parseCharacterDetailSnapshot({ character, freshness })
}

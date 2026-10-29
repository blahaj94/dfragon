import { NEOPLE_SERVER_NAMES } from '../constants/neople-character-search.js'
import { CharacterDetailFailure } from './details/errors.js'

export const CHARACTER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,256}$/
export const CHARACTER_ID_PATTERN_SOURCE = CHARACTER_ID_PATTERN.source

export interface CharacterIdentity {
  characterId: string
  serverId: string
}

export function parseCharacterIdentity(
  serverId: unknown,
  characterId: unknown,
  originalUrl: string
): CharacterIdentity {
  if (
    typeof serverId !== 'string' ||
    !NEOPLE_SERVER_NAMES.has(serverId) ||
    typeof characterId !== 'string' ||
    !CHARACTER_ID_PATTERN.test(characterId) ||
    originalUrl.includes('?')
  ) {
    throw new CharacterDetailFailure('query')
  }

  return { serverId, characterId }
}

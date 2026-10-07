import { NEOPLE_SERVER_NAMES } from '../constants/neople-character-search.js'
import { CharacterDetailFailure } from './details/errors.js'

export const CHARACTER_ID_PATTERN_SOURCE = '^[a-zA-Z0-9_-]{1,256}$'
const INVALID_CHARACTER_ID_CHARACTERS_PATTERN = /[^a-zA-Z0-9_-]/
const MAX_CHARACTER_ID_LENGTH = 256

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
    characterId.length === 0 ||
    characterId.length > MAX_CHARACTER_ID_LENGTH ||
    INVALID_CHARACTER_ID_CHARACTERS_PATTERN.test(characterId) ||
    originalUrl.includes('?')
  ) {
    throw new CharacterDetailFailure('query')
  }

  return { serverId, characterId }
}

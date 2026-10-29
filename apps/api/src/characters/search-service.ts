import { pick, sortBy } from 'remeda'
import { NeopleSearchFailure } from '../errors/neople-search.js'
import type {
  CharacterCandidate,
  CharacterImageCandidate,
  CharacterSearchResult,
  NeopleCharacterSearchInput,
  NeopleCharacterSearchResult
} from '../types/neople-character-search.js'
import { parseCharacterCandidatesQuery, parseCharacterSearchQuery } from './query.js'
import type { CharacterSearchDependencies, CharacterSearchHttpService } from './types.js'

export function createCharacterSearchService(
  dependencies: CharacterSearchDependencies
): CharacterSearchHttpService {
  const { searchCharacters } = dependencies
  let closed = false

  const search = async (
    input: NeopleCharacterSearchInput
  ): Promise<NeopleCharacterSearchResult> => {
    if (closed) {
      throw new NeopleSearchFailure('internal')
    }

    try {
      return await searchCharacters(input)
    } catch (error) {
      if (error instanceof NeopleSearchFailure) {
        throw error
      }
      throw new NeopleSearchFailure('internal', { cause: error })
    }
  }

  return {
    async search(originalUrl) {
      const input = parseCharacterSearchQuery(originalUrl)

      const result = await search(input)
      const rows = result.rows.map(
        (row): CharacterCandidate =>
          pick(row, ['characterId', 'characterName', 'serverId', 'serverName', 'fame'])
      )

      return { rows } satisfies CharacterSearchResult
    },
    async candidates(originalUrl) {
      const input = parseCharacterCandidatesQuery(originalUrl)
      const result = await search(input)
      const candidates = result.rows.map((candidate): CharacterImageCandidate => {
        const serverId = encodeURIComponent(candidate.serverId)
        const characterId = encodeURIComponent(candidate.characterId)
        const imageUrl = `https://img-api.neople.co.kr/df/servers/${serverId}/characters/${characterId}?zoom=1`
        // 모험단명은 저장한 상세에서 찾던 값이다. 기존 Desktop이 읽는 필드라 null로 남긴다.

        return { ...candidate, imageUrl, adventureName: null }
      })
      const rows = sortBy(
        candidates,
        [(row) => row.fame === null, 'asc'],
        [(row) => row.fame ?? 0, 'desc']
      )

      return { rows }
    },
    async onModuleDestroy() {
      closed = true
    }
  }
}

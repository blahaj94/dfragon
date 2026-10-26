import { NeopleSearchFailure, neopleSearchFailure } from '../errors/neople-search.js'
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
  const deps = Object.freeze({ ...dependencies })
  const adapter = deps.searchCharacters
  let closed = false

  const search = async (
    peerAddress: string | undefined,
    input: NeopleCharacterSearchInput,
    requestSignal?: AbortSignal
  ): Promise<NeopleCharacterSearchResult> => {
    const cannotStart = closed || !peerAddress || requestSignal?.aborted === true
    if (cannotStart) {
      throw neopleSearchFailure('internal')
    }

    try {
      return await adapter(input)
    } catch (error) {
      const isSearchFailure = error instanceof NeopleSearchFailure
      if (isSearchFailure) {
        throw error
      }
      throw neopleSearchFailure('internal', { cause: error })
    }
  }

  return {
    async search(peerAddress, originalUrl, requestSignal) {
      const input = parseCharacterSearchQuery(originalUrl)

      const result = await search(peerAddress, input, requestSignal)
      // 직업명은 후보 API의 계약이라 기존 검색 응답은 다섯 field로 유지한다.
      const rows = result.rows.map(
        ({ characterId, characterName, serverId, serverName, fame }): CharacterCandidate => ({
          characterId,
          characterName,
          serverId,
          serverName,
          fame
        })
      )

      return { rows } satisfies CharacterSearchResult
    },
    async candidates(peerAddress, originalUrl, requestSignal) {
      const input = parseCharacterCandidatesQuery(originalUrl)
      const result = await search(peerAddress, input, requestSignal)
      const rows = result.rows.map((candidate): CharacterImageCandidate => {
        const serverId = encodeURIComponent(candidate.serverId)
        const characterId = encodeURIComponent(candidate.characterId)
        const imageUrl = `https://img-api.neople.co.kr/df/servers/${serverId}/characters/${characterId}?zoom=1`
        // 모험단명은 저장한 상세에서 찾던 값이다. 기존 Desktop이 읽는 필드라 null로 남긴다.

        return { ...candidate, imageUrl, adventureName: null }
      })
      rows.sort((left, right) => {
        if (left.fame === null && right.fame === null) {
          return 0
        }

        if (left.fame === null) {
          return 1
        }

        if (right.fame === null) {
          return -1
        }

        return right.fame - left.fame
      })

      return { rows }
    },
    async onModuleDestroy() {
      closed = true
    }
  }
}

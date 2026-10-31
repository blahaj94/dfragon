import { pick, sortBy } from 'remeda'
import { NeopleSearchFailure } from '../errors/neople-search.js'
import type {
  CharacterCandidate,
  CharacterCandidatesResult,
  CharacterImageCandidate,
  CharacterSearchResult,
  NeopleCharacterSearchInput,
  NeopleCharacterSearchResult
} from '../types/neople-character-search.js'
import { parseCharacterCandidatesQuery, parseCharacterSearchQuery } from './query.js'
import { createCandidateCache } from './candidate-cache.js'
import type { CharacterSearchDependencies, CharacterSearchHttpService } from './types.js'

export function createCharacterSearchService(
  dependencies: CharacterSearchDependencies
): CharacterSearchHttpService {
  const { searchCharacters } = dependencies
  const candidateCache = createCandidateCache()
  let closed = false

  const assertOpen = (): void => {
    if (closed) {
      throw new NeopleSearchFailure('internal')
    }
  }

  const search = async (
    input: NeopleCharacterSearchInput
  ): Promise<NeopleCharacterSearchResult> => {
    assertOpen()

    try {
      return await searchCharacters(input)
    } catch (error) {
      if (error instanceof NeopleSearchFailure) {
        throw error
      }
      throw new NeopleSearchFailure('internal', { cause: error })
    }
  }

  const loadCandidates = async (
    input: NeopleCharacterSearchInput
  ): Promise<CharacterCandidatesResult> => {
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
      assertOpen()

      // 키는 요청 이름 그대로다. Neople match는 대소문자를 무시하지만 후보에는 요청 이름과 정확히 같은 이름만 남는다.

      return candidateCache.get(input.characterName, () => loadCandidates(input))
    },
    async onModuleDestroy() {
      closed = true
      candidateCache.close()
    }
  }
}

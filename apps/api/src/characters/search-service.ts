import { NeopleSearchFailure, neopleSearchFailure } from '../errors/neople-search.js'
import type {
  CharacterImageCandidate,
  CharacterSearchResult,
  NeopleCharacterSearchInput
} from '../types/neople-character-search.js'
import { parseCharacterCandidatesQuery, parseCharacterSearchQuery } from './query.js'
import { SearchAdmission, searchClock } from './search-admission.js'
import { SearchDeadline } from './search-deadline.js'
import type { CharacterSearchDependencies, CharacterSearchHttpService } from './types.js'

export function createCharacterSearchService(
  dependencies: CharacterSearchDependencies
): CharacterSearchHttpService {
  const deps = Object.freeze({ ...dependencies })
  const clock = deps.clock ?? searchClock
  const admission = new SearchAdmission(clock)
  const adapter = deps.searchCharacters
  const active = new Set<SearchDeadline>()
  let closed = false

  const search = async (
    peerAddress: string | undefined,
    input: NeopleCharacterSearchInput,
    requestSignal?: AbortSignal
  ): Promise<CharacterSearchResult> => {
    const cannotStart = closed || !peerAddress
    if (cannotStart) {
      throw neopleSearchFailure('internal')
    }

    const deadline = new SearchDeadline(clock, requestSignal)
    active.add(deadline)
    let lease: Awaited<ReturnType<SearchAdmission['acquire']>> | undefined
    const finishAdmission = (): void => {
      lease?.release()
      deadline.dispose()
      active.delete(deadline)
    }
    try {
      lease = await deadline.wait(admission.acquire(peerAddress, deadline.signal))
      lease.assertCapacity()
      // 예약과 기존 adapter 시작 사이에 await를 두지 않는다.
      deadline.check()
      lease.reserve()
      const result = adapter(input)
      finishAdmission()

      return await result
    } catch (error) {
      const isSearchFailure = error instanceof NeopleSearchFailure
      if (isSearchFailure) {
        throw error
      }
      throw neopleSearchFailure('internal', { cause: error })
    } finally {
      finishAdmission()
    }
  }

  return {
    async search(peerAddress, originalUrl, requestSignal) {
      const input = parseCharacterSearchQuery(originalUrl)

      return search(peerAddress, input, requestSignal)
    },
    async candidates(peerAddress, originalUrl, requestSignal) {
      const input = parseCharacterCandidatesQuery(originalUrl)
      const result = await search(peerAddress, input, requestSignal)
      const rows = result.rows.map((candidate): CharacterImageCandidate => {
        const serverId = encodeURIComponent(candidate.serverId)
        const characterId = encodeURIComponent(candidate.characterId)
        const imageUrl = `https://img-api.neople.co.kr/df/servers/${serverId}/characters/${characterId}?zoom=1`

        return { ...candidate, imageUrl }
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
      for (const deadline of active) {
        deadline.abort()
      }
      admission.close()
    }
  }
}

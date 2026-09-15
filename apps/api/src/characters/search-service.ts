import { NeopleSearchFailure, neopleSearchFailure } from '../errors/neople-search.js'
import { createNeopleCharacterSearch } from './neople-character-search.js'
import { parseCharacterSearchQuery } from './query.js'
import { SearchAdmission, searchClock } from './search-admission.js'
import { SearchDeadline } from './search-deadline.js'
import type { CharacterSearchDependencies, CharacterSearchHttpService } from './types.js'

export function createCharacterSearchService(
  dependencies: CharacterSearchDependencies
): CharacterSearchHttpService {
  const deps = Object.freeze({ ...dependencies })
  const clock = deps.clock ?? searchClock
  const admission = new SearchAdmission(clock)
  const adapter = deps.searchCharacters ?? createNeopleCharacterSearch(deps.apiKey)
  const active = new Set<SearchDeadline>()
  let closed = false

  return {
    async search(peerAddress, originalUrl, requestSignal) {
      const input = parseCharacterSearchQuery(originalUrl)
      const isKeyString = typeof deps.apiKey === 'string'
      if (!isKeyString) {
        throw neopleSearchFailure('internal')
      }
      const hasKey = deps.apiKey.length > 0
      const cannotStart = !hasKey || closed || !peerAddress
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
        throw neopleSearchFailure('internal')
      } finally {
        finishAdmission()
      }
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

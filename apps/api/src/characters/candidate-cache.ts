import { LRUCache } from 'lru-cache'
import type { CharacterCandidatesResult } from '../types/neople-character-search.js'
import type { CharacterCandidatesResponse } from './types.js'

const CANDIDATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000
// A row measured about 0.4KB on the heap (2026-10-31) and one name has one row per server, 8 at most in practice, so
// 5,000 names stay near 15MB. Even the 200-row Neople limit would only reach about 350MB.
const CANDIDATE_CACHE_MAX_NAMES = 5_000

// A fetch has no signal to abort, so one caller's disconnect cannot cancel the others and shutdown only forgets it.
export function createCandidateCache() {
  const cached = new LRUCache<string, CharacterCandidatesResult>({
    max: CANDIDATE_CACHE_MAX_NAMES,
    ttl: CANDIDATE_CACHE_TTL_MS
  })
  const inFlight = new Map<string, Promise<CharacterCandidatesResult>>()

  return {
    async get(
      characterName: string,
      load: () => Promise<CharacterCandidatesResult>
    ): Promise<CharacterCandidatesResponse> {
      const stored = cached.get(characterName)
      if (stored !== undefined) {
        return { result: stored, source: 'cache' }
      }

      const joined = inFlight.get(characterName)
      if (joined !== undefined) {
        return { result: await joined, source: 'shared' }
      }

      const started: Promise<CharacterCandidatesResult> = load()
        .then((result) => {
          // An empty result stays out so a character created under this name is found at once,
          // and a fetch forgotten by close() must not write late.
          if (result.rows.length > 0 && inFlight.get(characterName) === started) {
            cached.set(characterName, result)
          }

          return result
        })
        .finally(() => {
          if (inFlight.get(characterName) === started) {
            inFlight.delete(characterName)
          }
        })
      inFlight.set(characterName, started)

      return { result: await started, source: 'neople' }
    },
    close() {
      inFlight.clear()
      cached.clear()
    }
  }
}

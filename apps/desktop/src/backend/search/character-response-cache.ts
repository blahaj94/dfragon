import type { CharacterCandidate, CharacterDetails } from '../../preload/common/types/character'
import type { CharacterCandidatesHttp, CharacterDetailsHttp } from './character-http'
import { CompletedCache } from './completed-cache'

const TTL_MS = 5 * 60_000

function cacheCompleted<Input extends { signal: AbortSignal }, Value>(
  load: (input: Input) => Promise<Value>,
  keyOf: (input: Input) => string,
  cache: CompletedCache<Value>
): (input: Input) => Promise<Value> {
  return async (input) => {
    input.signal.throwIfAborted()
    const key = keyOf(input)
    const cached = cache.read(key)
    if (cached !== undefined) {
      return structuredClone(cached)
    }
    const value = await load(input)
    input.signal.throwIfAborted()
    const serialized = JSON.stringify(value)
    cache.write(key, structuredClone(value), Buffer.byteLength(serialized, 'utf8'))

    return value
  }
}

export function createCachedCharacterCandidates(
  load: CharacterCandidatesHttp
): CharacterCandidatesHttp {
  const cache = new CompletedCache<readonly CharacterCandidate[]>({
    maximumEntries: 256,
    maximumBytes: 8 * 1024 * 1024,
    ttlMs: TTL_MS
  })

  return cacheCompleted(load, ({ nickname }) => nickname, cache)
}

export function createCachedCharacterDetails(load: CharacterDetailsHttp): CharacterDetailsHttp {
  const cache = new CompletedCache<CharacterDetails>({
    maximumEntries: 128,
    maximumBytes: 64 * 1024 * 1024,
    ttlMs: TTL_MS
  })

  return cacheCompleted(load, ({ serverId, characterId }) => `${serverId}/${characterId}`, cache)
}

import { CharacterDetailFailure, characterDetailFailure } from '../characters/details/errors.js'
import { parseAdventureSearchQuery } from './query.js'
import type { AdventureSearchStore } from './store.js'

export function createAdventureSearchService(store: AdventureSearchStore) {
  const shutdown = new AbortController()
  const active = new Set<Promise<unknown>>()
  const search = async (peer: string | undefined, url: string, requestSignal: AbortSignal) => {
    const input = parseAdventureSearchQuery(url)
    const signal = AbortSignal.any([requestSignal, shutdown.signal])
    try {
      if (!peer || signal.aborted) {
        throw new CharacterDetailFailure('internal')
      }
      const result = await store.search(input, signal)
      signal.throwIfAborted()

      return result
    } catch (error) {
      throw characterDetailFailure(error)
    }
  }

  return {
    search(peer: string | undefined, url: string, signal: AbortSignal) {
      const operation = search(peer, url, signal)
      active.add(operation)
      void operation.finally(() => active.delete(operation)).catch(() => undefined)

      return operation
    },
    async onModuleDestroy() {
      shutdown.abort()
      await Promise.allSettled(active)
    }
  }
}

export type AdventureSearchService = ReturnType<typeof createAdventureSearchService>

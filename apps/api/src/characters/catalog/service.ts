import { chunk } from 'remeda'
import { CATALOG_LIMITS, unavailableDetail } from './types.js'
import type { CatalogDetail } from './types.js'
import type { FetchCatalog } from './neople.js'

export function createCatalogService(fetchCatalog: FetchCatalog, timeoutMs = 10_000) {
  return {
    async load(itemIds: string[], requestSignal: AbortSignal): Promise<Map<string, CatalogDetail>> {
      const unique = [...new Set(itemIds)]
      const details = new Map<string, CatalogDetail>(
        unique.map((itemId) => [itemId, unavailableDetail])
      )
      requestSignal.throwIfAborted()
      if (unique.length === 0) {
        return details
      }
      // A malformed upstream character cannot turn a public request into unbounded fan-out.
      const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(timeoutMs)])
      const bounded = unique.slice(0, CATALOG_LIMITS.maximumReferencesPerLoad)
      await Promise.all(
        chunk(bounded, CATALOG_LIMITS.maximumBatchKeys).map(async (group) => {
          try {
            const payloads = await fetchCatalog(group, signal)
            signal.throwIfAborted()
            const fetchedAt = new Date().toISOString()
            for (const [itemId, data] of payloads) {
              details.set(itemId, { data, fetchedAt, status: 'fresh' })
            }
          } catch {
            // A failed lookup leaves the reference unavailable; the character response still succeeds.
          }
        })
      )
      requestSignal.throwIfAborted()

      return details
    }
  }
}

export type CatalogService = ReturnType<typeof createCatalogService>

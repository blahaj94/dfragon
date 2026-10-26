import { chunk } from 'remeda'
import { CATALOG_LIMITS, catalogKey, unavailableDetail } from './types.js'
import type { CatalogDetail, CatalogKey, CatalogResult } from './types.js'
import type { FetchCatalog } from './neople.js'

export function createCatalogService(fetchCatalog: FetchCatalog, timeoutMs = 10_000) {
  return {
    async load(
      keys: CatalogKey[],
      requestSignal: AbortSignal
    ): Promise<Map<string, CatalogResult>> {
      const unique = [...new Map(keys.map((key) => [catalogKey(key), key])).values()]
      const results = new Map<string, CatalogResult>(
        unique.map((key) => [catalogKey(key), { key, detail: unavailableDetail }])
      )
      requestSignal.throwIfAborted()
      if (unique.length === 0) {
        return results
      }
      // A malformed upstream character cannot turn a public request into unbounded fan-out.
      const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(timeoutMs)])
      async function loadReferences(references: CatalogKey[]) {
        const bounded = references.slice(0, CATALOG_LIMITS.maximumReferencesPerLoad)
        if (bounded.length === 0 || signal.aborted) {
          return
        }
        const groups = chunk(bounded, CATALOG_LIMITS.maximumBatchKeys)
        await Promise.all(
          groups.map(async (group) => {
            if (signal.aborted) {
              return
            }
            try {
              const values = await fetchCatalog(group, signal)
              signal.throwIfAborted()
              const fetchedAt = new Date().toISOString()
              for (const value of values) {
                const detail: CatalogDetail = { data: value.payload, fetchedAt, status: 'fresh' }
                results.set(catalogKey(value.key), { key: value.key, detail })
              }
            } catch {
              // A failed lookup leaves the reference unavailable; the character response still succeeds.
            }
          })
        )
      }
      await loadReferences(unique)
      requestSignal.throwIfAborted()

      return results
    }
  }
}

export type CatalogService = ReturnType<typeof createCatalogService>

import { chunk, filter, map } from 'remeda'
import { CATALOG_LIMITS, catalogKey, isCatalogId, unavailableDetail } from './types.js'
import type { CatalogDetail, CatalogKey, CatalogResult } from './types.js'
import type { FetchCatalog } from './neople.js'

function createCatalogRequestGroups(keys: CatalogKey[]): CatalogKey[][] {
  const itemBatches = chunk(
    filter(keys, (key) => key.kind === 'item'),
    CATALOG_LIMITS.maximumBatchKeys
  )
  const setBatches = chunk(
    filter(keys, (key) => key.kind === 'set'),
    CATALOG_LIMITS.maximumBatchKeys
  )
  const skillRequests = map(
    filter(keys, (key) => key.kind === 'skill'),
    (key) => [key]
  )

  return [...itemBatches, ...setBatches, ...skillRequests]
}

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
      let remaining: number = CATALOG_LIMITS.maximumReferencesPerLoad
      const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(timeoutMs)])
      async function loadReferences(references: CatalogKey[]) {
        const bounded = references.slice(0, remaining)
        remaining -= bounded.length
        if (bounded.length === 0 || signal.aborted) {
          return
        }
        const groups = createCatalogRequestGroups(bounded)
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
      // Follow only the set IDs of fetched item details, never set members or oath.setInfo.setId.
      const sets: CatalogKey[] = []
      for (const key of unique) {
        if (key.kind !== 'item') {
          continue
        }
        const setItemId = results.get(catalogKey(key))?.detail.data?.setItemId
        if (!isCatalogId(setItemId)) {
          continue
        }
        const setKey: CatalogKey = { kind: 'set', setItemId }
        const id = catalogKey(setKey)
        if (!results.has(id)) {
          results.set(id, { key: setKey, detail: unavailableDetail })
          sets.push(setKey)
        }
      }
      await loadReferences(sets)
      requestSignal.throwIfAborted()

      return results
    }
  }
}

export type CatalogService = ReturnType<typeof createCatalogService>

import { catalogKey, isCatalogId, unavailableDetail } from './types.js'
import type { CatalogDetail, CatalogKey } from './types.js'
import type { CatalogStore } from './store.js'
import type { FetchCatalog } from './neople.js'

export function createCatalogService(
  store: CatalogStore,
  fetchCatalog: FetchCatalog,
  timeoutMs = 10_000
) {
  return {
    async load(
      keys: CatalogKey[],
      requestSignal: AbortSignal
    ): Promise<Map<string, CatalogDetail>> {
      const unique = [...new Map(keys.map((key) => [catalogKey(key), key])).values()]
      const results = new Map(unique.map((key) => [catalogKey(key), unavailableDetail]))
      requestSignal.throwIfAborted()
      if (unique.length === 0) {
        return results
      }
      // A malformed upstream character cannot turn a public request into unbounded fan-out.
      let remaining = 128
      const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(timeoutMs)])
      async function loadReferences(references: CatalogKey[]) {
        const bounded = references.slice(0, remaining)
        remaining -= bounded.length
        if (bounded.length === 0 || signal.aborted) {
          return
        }
        try {
          const snapshot = await store.read(bounded, signal)
          for (const entry of snapshot.entries) {
            results.set(catalogKey(entry.key), {
              data: entry.payload,
              fetchedAt: entry.fetchedAt.toISOString(),
              status: entry.expiresAt > snapshot.now ? 'fresh' : 'stale'
            })
          }
          const pending = bounded.filter((key) => results.get(catalogKey(key))!.status !== 'fresh')
          const groups: CatalogKey[][] = []
          for (const kind of ['item', 'set'] as const) {
            const batchKeys = pending.filter((key) => key.kind === kind)
            for (let i = 0; i < batchKeys.length; i += 15) {
              groups.push(batchKeys.slice(i, i + 15))
            }
          }
          groups.push(...pending.filter((key) => key.kind === 'skill').map((key) => [key]))
          let next = 0
          await Promise.all(
            Array.from({ length: Math.min(3, groups.length) }, async () => {
              while (next < groups.length && !signal.aborted) {
                const group = groups[next++]!
                try {
                  const values = await fetchCatalog(group, signal)
                  signal.throwIfAborted()
                  if (values.length === 0) {
                    continue
                  }
                  const stored = await store.saveAndRead(values, snapshot.requestedAt, signal)
                  for (const entry of stored.entries) {
                    results.set(catalogKey(entry.key), {
                      data: entry.payload,
                      fetchedAt: entry.fetchedAt.toISOString(),
                      status: entry.expiresAt > stored.now ? 'fresh' : 'stale'
                    })
                  }
                } catch {
                  // Only committed catalog data may be returned. An unsuccessful refresh retains its prior value.
                }
              }
            })
          )
        } catch {
          // Catalog storage is optional enrichment; character persistence has already succeeded.
        }
      }
      await loadReferences(unique)
      // Follow only the set IDs of committed item details, never set members or oath.setInfo.setId.
      const sets: CatalogKey[] = []
      for (const key of unique) {
        if (key.kind !== 'item') {
          continue
        }
        const setItemId = results.get(catalogKey(key))?.data?.setItemId
        if (!isCatalogId(setItemId)) {
          continue
        }
        const setKey: CatalogKey = { kind: 'set', setItemId }
        const id = catalogKey(setKey)
        if (!results.has(id)) {
          results.set(id, unavailableDetail)
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

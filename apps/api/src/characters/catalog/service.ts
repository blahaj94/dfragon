import { chunk, filter, map } from 'remeda'
import { catalogKey, isCatalogId, unavailableDetail } from './types.js'
import type { CatalogDetail, CatalogKey, CatalogResult } from './types.js'
import type { CatalogStore } from './store.js'
import type { FetchCatalog } from './neople.js'

function createCatalogRequestGroups(keys: CatalogKey[]): CatalogKey[][] {
  const itemBatches = chunk(
    filter(keys, (key) => key.kind === 'item'),
    15
  )
  const setBatches = chunk(
    filter(keys, (key) => key.kind === 'set'),
    15
  )
  const skillRequests = map(
    filter(keys, (key) => key.kind === 'skill'),
    (key) => [key]
  )

  return [...itemBatches, ...setBatches, ...skillRequests]
}

export function createCatalogService(
  store: CatalogStore,
  fetchCatalog: FetchCatalog,
  timeoutMs = 10_000
) {
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
            const detail: CatalogDetail = {
              data: entry.payload,
              fetchedAt: entry.fetchedAt.toISOString(),
              status: entry.expiresAt > snapshot.now ? 'fresh' : 'stale'
            }
            results.set(catalogKey(entry.key), { key: entry.key, detail })
          }
          const pending = bounded.filter(
            (key) => results.get(catalogKey(key))!.detail.status !== 'fresh'
          )
          const groups = createCatalogRequestGroups(pending)
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
                    const detail: CatalogDetail = {
                      data: entry.payload,
                      fetchedAt: entry.fetchedAt.toISOString(),
                      status: entry.expiresAt > stored.now ? 'fresh' : 'stale'
                    }
                    results.set(catalogKey(entry.key), { key: entry.key, detail })
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

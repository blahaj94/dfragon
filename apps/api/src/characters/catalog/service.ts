import DataLoader from 'dataloader'
import { LRUCache } from 'lru-cache'
import type { CharacterPayload } from '../details/sections.js'
import { CATALOG_LIMITS, unavailableDetail } from './types.js'
import type { CatalogDetail } from './types.js'
import type { FetchCatalog } from './neople.js'

const CATALOG_CACHE_TTL_MS = 24 * 60 * 60 * 1000
// One catalog item is about 1KB of JSON, so 10,000 items keep the cache near 10MB.
const CATALOG_CACHE_MAX_ITEMS = 10_000

interface FetchedCatalogItem {
  data: CharacterPayload
  fetchedAt: string
}

function waitForAbort(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
}

export function createCatalogService(fetchCatalog: FetchCatalog) {
  const shutdown = new AbortController()
  const pendingBatches = new Set<Promise<unknown>>()
  const batches = new DataLoader<string, FetchedCatalogItem | undefined>(
    async (itemIds) => {
      // A batch can serve several requests, so only shutdown, not one request's disconnect, cancels it.
      const batch = fetchCatalog([...itemIds], shutdown.signal)
      pendingBatches.add(batch)
      batch.finally(() => pendingBatches.delete(batch)).catch(() => undefined)
      const payloads = await batch
      const fetchedAt = new Date().toISOString()

      return itemIds.map((itemId) => {
        const data = payloads.get(itemId)
        if (data === undefined) {
          return undefined
        }

        return { data, fetchedAt }
      })
    },
    // The cache below already shares in-flight lookups by item ID.
    { cache: false, maxBatchSize: CATALOG_LIMITS.maximumBatchKeys }
  )
  // A rejected or undefined fetch leaves no entry, so failed and missing items are fetched again.
  const items = new LRUCache<string, FetchedCatalogItem>({
    max: CATALOG_CACHE_MAX_ITEMS,
    ttl: CATALOG_CACHE_TTL_MS,
    fetchMethod: (itemId) => batches.load(itemId)
  })

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
      const bounded = unique.slice(0, CATALOG_LIMITS.maximumReferencesPerLoad)
      const loading = Promise.all(
        bounded.map(async (itemId) => {
          try {
            const item = await items.fetch(itemId)
            if (item !== undefined) {
              details.set(itemId, { ...item, status: 'fresh' })
            }
          } catch {
            // A failed lookup leaves the reference unavailable; the character response still succeeds.
          }
        })
      )
      // A disconnected request stops waiting; its lookups still fill the cache for later requests.
      await Promise.race([loading, waitForAbort(requestSignal)])
      requestSignal.throwIfAborted()

      return details
    },
    async close() {
      shutdown.abort()
      await Promise.allSettled([...pendingBatches])
    }
  }
}

export type CatalogService = ReturnType<typeof createCatalogService>

import { NEOPLE_ORIGIN } from '../../constants/neople-character-search.js'
import { isObject } from '../details/neople.js'
import { CATALOG_LIMITS, isCatalogId } from './types.js'
import type { CatalogKey, CatalogValue } from './types.js'

export type FetchCatalog = (keys: CatalogKey[], signal: AbortSignal) => Promise<CatalogValue[]>

export function createNeopleCatalog(apiKey: string, fetchImpl = globalThis.fetch): FetchCatalog {
  return async (keys, requestSignal) => {
    const first = keys[0]
    if (
      !first ||
      keys.length > CATALOG_LIMITS.maximumBatchKeys ||
      keys.some((key) => !isCatalogId(key.itemId))
    ) {
      throw new Error('Invalid catalog request')
    }
    const params = new URLSearchParams({ itemIds: keys.map((key) => key.itemId).join(',') })
    const path = `/df/multi/items?${params}`

    if (requestSignal.aborted) {
      throw new Error('Catalog lookup failed')
    }

    try {
      const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(5000)])
      signal.throwIfAborted()
      const response = await fetchImpl(new URL(path, NEOPLE_ORIGIN), {
        headers: { apikey: apiKey },
        redirect: 'error',
        signal
      })
      if (!response.ok) {
        await response.body?.cancel()
        throw new Error('Catalog upstream failed')
      }
      const body: unknown = await response.json()
      signal.throwIfAborted()
      if (!isObject(body)) {
        throw new Error('Invalid catalog body')
      }

      if (!Array.isArray(body.rows)) {
        throw new Error('Invalid catalog list')
      }
      const rows = body.rows

      return keys.flatMap((key) => {
        const matches = rows.filter((row) => isObject(row) && row.itemId === key.itemId)
        const row: unknown = matches[0]

        if (
          matches.length === 1 &&
          isObject(row) &&
          typeof row.itemName === 'string' &&
          row.itemName.trim()
        ) {
          return [{ key, payload: row }]
        }

        return []
      })
    } catch {
      throw new Error('Catalog lookup failed')
    }
  }
}

import ky from 'ky'
import { NEOPLE_ORIGIN } from '../../constants/neople-character-search.js'
import type { FetchTransport } from '../../types/neople-character-search.js'
import { isObject } from '../details/neople.js'
import { CATALOG_LIMITS, isCatalogId } from './types.js'
import type { CatalogKey, CatalogValue } from './types.js'

export type FetchCatalog = (keys: CatalogKey[], signal: AbortSignal) => Promise<CatalogValue[]>

function selectRequestedRows(body: unknown, keys: CatalogKey[]): CatalogValue[] {
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
}

export function createNeopleCatalog(apiKey: string, fetchImpl?: FetchTransport): FetchCatalog {
  const neople = ky.create({
    baseUrl: NEOPLE_ORIGIN,
    fetch: fetchImpl,
    headers: { apikey: apiKey },
    redirect: 'error',
    retry: 0
  })

  return async (keys, requestSignal) => {
    const first = keys[0]
    if (
      !first ||
      keys.length > CATALOG_LIMITS.maximumBatchKeys ||
      keys.some((key) => !isCatalogId(key.itemId))
    ) {
      throw new Error('Invalid catalog request')
    }

    // ky hands an already aborted request to fetch, so this keeps a cancelled lookup off the transport.
    if (requestSignal.aborted) {
      throw new Error('Catalog lookup failed')
    }

    try {
      return await neople
        .get('/df/multi/items', {
          searchParams: { itemIds: keys.map((key) => key.itemId).join(',') },
          signal: requestSignal,
          parseJson: (rawBody) => selectRequestedRows(JSON.parse(rawBody), keys)
        })
        .json<CatalogValue[]>()
    } catch {
      throw new Error('Catalog lookup failed')
    }
  }
}

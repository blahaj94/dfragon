import { isRecord } from '@dfragon/lib/utils/shape-check'
import ky from 'ky'
import { NEOPLE_ORIGIN } from '../../constants/neople-character-search.js'
import type { FetchTransport } from '../../types/neople-character-search.js'
import type { CharacterPayload } from '../details/sections.js'
import { CATALOG_LIMITS, isCatalogId } from './types.js'

export type FetchCatalog = (
  itemIds: string[],
  signal: AbortSignal
) => Promise<Map<string, CharacterPayload>>

function selectRequestedRows(body: unknown, itemIds: string[]): Map<string, CharacterPayload> {
  if (!isRecord(body)) {
    throw new Error('Invalid catalog body')
  }

  if (!Array.isArray(body.rows)) {
    throw new Error('Invalid catalog list')
  }
  const rows = body.rows

  const payloads = new Map<string, CharacterPayload>()
  for (const itemId of itemIds) {
    const matches = rows.filter((row) => isRecord(row) && row.itemId === itemId)
    const row: unknown = matches[0]

    if (
      matches.length === 1 &&
      isRecord(row) &&
      typeof row.itemName === 'string' &&
      row.itemName.trim()
    ) {
      payloads.set(itemId, row)
    }
  }

  return payloads
}

export function createNeopleCatalog(apiKey: string, fetchImpl?: FetchTransport): FetchCatalog {
  const neople = ky.create({
    baseUrl: NEOPLE_ORIGIN,
    fetch: fetchImpl,
    headers: { apikey: apiKey },
    redirect: 'error',
    retry: 0
  })

  return async (itemIds, signal) => {
    if (
      itemIds.length === 0 ||
      itemIds.length > CATALOG_LIMITS.maximumBatchKeys ||
      itemIds.some((itemId) => !isCatalogId(itemId))
    ) {
      throw new Error('Invalid catalog request')
    }

    try {
      return await neople
        .get('/df/multi/items', {
          signal,
          searchParams: { itemIds: itemIds.join(',') },
          parseJson: (rawBody) => selectRequestedRows(JSON.parse(rawBody), itemIds)
        })
        .json<Map<string, CharacterPayload>>()
    } catch {
      throw new Error('Catalog lookup failed')
    }
  }
}

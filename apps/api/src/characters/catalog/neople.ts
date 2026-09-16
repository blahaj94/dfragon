import { NEOPLE_ORIGIN } from '../../constants/neople-character-search.js'
import { isObject } from '../details/neople.js'
import { isCatalogId } from './types.js'
import type { CatalogKey, CatalogValue } from './types.js'

export type FetchCatalog = (keys: CatalogKey[], signal: AbortSignal) => Promise<CatalogValue[]>

export function createNeopleCatalog(apiKey: string, fetchImpl = globalThis.fetch): FetchCatalog {
  return async (keys, requestSignal) => {
    const first = keys[0]
    if (
      !first ||
      keys.length > 15 ||
      keys.some((key) =>
        key.kind === 'item'
          ? !isCatalogId(key.itemId)
          : key.kind === 'set'
            ? !isCatalogId(key.setItemId)
            : !isCatalogId(key.jobId) || !isCatalogId(key.skillId)
      )
    ) {
      throw new Error('Invalid catalog request')
    }
    let path: string
    if (first.kind === 'item' && keys.every((key) => key.kind === 'item')) {
      const params = new URLSearchParams({ itemIds: keys.map((key) => key.itemId).join(',') })
      path = `/df/multi/items?${params}`
    } else if (first.kind === 'set' && keys.every((key) => key.kind === 'set')) {
      const params = new URLSearchParams({ setItemIds: keys.map((key) => key.setItemId).join(',') })
      path = `/df/multi/setitems?${params}`
    } else if (first.kind === 'skill' && keys.length === 1) {
      // The skill response has no skillId. A single request retains an unambiguous identity.
      path = `/df/skills/${encodeURIComponent(first.jobId)}/${encodeURIComponent(first.skillId)}`
    } else {
      throw new Error('Invalid catalog batch')
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
      if (first.kind === 'skill') {
        if (
          body.jobId !== first.jobId ||
          typeof body.name !== 'string' ||
          !body.name.trim() ||
          (Object.hasOwn(body, 'skillId') && body.skillId !== first.skillId)
        ) {
          throw new Error('Invalid skill identity')
        }
        return [{ key: first, payload: body }]
      }
      if (!Array.isArray(body.rows)) {
        throw new Error('Invalid catalog list')
      }
      const rows = body.rows
      return keys.flatMap((key) => {
        if (key.kind === 'skill') {
          return []
        }
        const idField = key.kind === 'item' ? 'itemId' : 'setItemId'
        const nameField = key.kind === 'item' ? 'itemName' : 'setItemName'
        const id = key.kind === 'item' ? key.itemId : key.setItemId
        const matches = rows.filter((row) => isObject(row) && row[idField] === id)
        const row: unknown = matches[0]
        // Missing/duplicate rows do not poison correctly identified neighbors in this batch.
        return matches.length === 1 &&
          isObject(row) &&
          typeof row[nameField] === 'string' &&
          row[nameField].trim()
          ? [{ key, payload: row }]
          : []
      })
    } catch {
      throw new Error('Catalog lookup failed')
    }
  }
}

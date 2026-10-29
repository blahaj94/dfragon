import { CHARACTER_ID_PATTERN } from '../identity.js'
import type { CharacterPayload } from '../details/sections.js'

export const CATALOG_LIMITS = {
  maximumBatchKeys: 15,
  maximumReferencesPerLoad: 128
} as const

export type CatalogKey = { kind: 'item'; itemId: string }

export interface CatalogValue {
  key: CatalogKey
  payload: CharacterPayload
}

export interface CatalogDetail {
  data: CharacterPayload | null
  fetchedAt: string | null
  status: 'fresh' | 'unavailable'
}

export interface CatalogResult {
  key: CatalogKey
  detail: CatalogDetail
}

export function catalogKey(key: CatalogKey): string {
  return `item:${key.itemId}`
}

export function isCatalogId(value: unknown): value is string {
  return typeof value === 'string' && CHARACTER_ID_PATTERN.test(value)
}

export const unavailableDetail: CatalogDetail = {
  data: null,
  fetchedAt: null,
  status: 'unavailable'
}

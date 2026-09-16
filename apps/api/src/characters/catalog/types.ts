import type { CharacterPayload } from '../details/sections.js'

export type CatalogKey =
  { kind: 'item'; itemId: string } | { kind: 'skill'; jobId: string; skillId: string }

export interface CatalogValue {
  key: CatalogKey
  payload: CharacterPayload
}

export interface CatalogEntry extends CatalogValue {
  fetchedAt: Date
  expiresAt: Date
}

export interface CatalogDetail {
  data: CharacterPayload | null
  fetchedAt: string | null
  status: 'fresh' | 'stale' | 'unavailable'
}

export function catalogKey(key: CatalogKey): string {
  return key.kind === 'item' ? `item:${key.itemId}` : `skill:${key.jobId}:${key.skillId}`
}

export function isCatalogId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,256}$/.test(value)
}

export const unavailableDetail: CatalogDetail = {
  data: null,
  fetchedAt: null,
  status: 'unavailable'
}

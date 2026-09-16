import { EntitySchema } from 'typeorm'
import type { CharacterPayload } from '../../characters/details/sections.js'

export interface ItemCatalog {
  itemId: string
  payload: CharacterPayload
  fetchedAt: Date
  expiresAt: Date
  requestStartedAt: Date
}

export const ItemCatalogSchema = new EntitySchema<ItemCatalog>({
  name: 'ItemCatalog',
  tableName: 'item_catalog',
  columns: {
    itemId: {
      name: 'item_id',
      type: 'text',
      primary: true,
      primaryKeyConstraintName: 'pk_item_catalog'
    },
    payload: { type: 'jsonb' },
    fetchedAt: { name: 'fetched_at', type: 'timestamptz' },
    expiresAt: { name: 'expires_at', type: 'timestamptz' },
    requestStartedAt: { name: 'request_started_at', type: 'timestamptz' }
  },
  checks: [
    {
      name: 'ck_item_catalog_id',
      expression: 'length("item_id") BETWEEN 1 AND 256 AND "item_id" ~ \'^[a-zA-Z0-9_-]+$\''
    },
    { name: 'ck_item_catalog_payload', expression: 'jsonb_typeof("payload") = \'object\'' }
  ]
})

import { EntitySchema } from 'typeorm'
import type { CharacterPayload } from '../../characters/details/sections.js'

export interface SetItemCatalog {
  setItemId: string
  payload: CharacterPayload
  fetchedAt: Date
  expiresAt: Date
  requestStartedAt: Date
}

export const SetItemCatalogSchema = new EntitySchema<SetItemCatalog>({
  name: 'SetItemCatalog',
  tableName: 'set_item_catalog',
  columns: {
    setItemId: {
      name: 'set_item_id',
      type: 'text',
      primary: true,
      primaryKeyConstraintName: 'pk_set_item_catalog'
    },
    payload: { type: 'jsonb' },
    fetchedAt: { name: 'fetched_at', type: 'timestamptz' },
    expiresAt: { name: 'expires_at', type: 'timestamptz' },
    requestStartedAt: { name: 'request_started_at', type: 'timestamptz' }
  },
  checks: [
    {
      name: 'ck_set_item_catalog_id',
      expression: 'length("set_item_id") BETWEEN 1 AND 256 AND "set_item_id" ~ \'^[a-zA-Z0-9_-]+$\''
    },
    { name: 'ck_set_item_catalog_payload', expression: 'jsonb_typeof("payload") = \'object\'' }
  ]
})

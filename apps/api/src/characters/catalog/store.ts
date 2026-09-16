import type { DataSource, EntityManager } from 'typeorm'
import { ItemCatalogSchema } from '../../database/schemas/item-catalog.js'
import { SetItemCatalogSchema } from '../../database/schemas/set-item-catalog.js'
import { SkillCatalogSchema } from '../../database/schemas/skill-catalog.js'
import type { CatalogEntry, CatalogKey, CatalogValue } from './types.js'

export interface CatalogStore {
  read(
    keys: CatalogKey[],
    signal: AbortSignal
  ): Promise<{ entries: CatalogEntry[]; requestedAt: string; now: Date }>
  saveAndRead(
    values: CatalogValue[],
    requestedAt: string,
    signal: AbortSignal
  ): Promise<{ entries: CatalogEntry[]; now: Date }>
}

async function readEntries(manager: EntityManager, keys: CatalogKey[]): Promise<CatalogEntry[]> {
  const itemKeys = keys.filter((key) => key.kind === 'item').map(({ itemId }) => ({ itemId }))
  const setKeys = keys.filter((key) => key.kind === 'set').map(({ setItemId }) => ({ setItemId }))
  const skillKeys = keys
    .filter((key) => key.kind === 'skill')
    .map(({ jobId, skillId }) => ({ jobId, skillId }))
  const items = itemKeys.length
    ? await manager.getRepository(ItemCatalogSchema).findBy(itemKeys)
    : []
  const sets = setKeys.length
    ? await manager.getRepository(SetItemCatalogSchema).findBy(setKeys)
    : []
  const skills = skillKeys.length
    ? await manager.getRepository(SkillCatalogSchema).findBy(skillKeys)
    : []
  return [
    ...items.map((row): CatalogEntry => ({ ...row, key: { kind: 'item', itemId: row.itemId } })),
    ...sets.map((row): CatalogEntry => ({
      ...row,
      key: { kind: 'set', setItemId: row.setItemId }
    })),
    ...skills.map((row): CatalogEntry => ({
      ...row,
      key: { kind: 'skill', jobId: row.jobId, skillId: row.skillId }
    }))
  ]
}

async function boundStatements(manager: EntityManager) {
  await manager.query("SET LOCAL statement_timeout = '2s'")
  await manager.query("SET LOCAL lock_timeout = '2s'")
}

export function createCatalogStore(source: DataSource): CatalogStore {
  return {
    async read(keys, signal) {
      return source.transaction('READ COMMITTED', async (manager) => {
        signal.throwIfAborted()
        await boundStatements(manager)
        const [clock] = (await manager.query(
          'SELECT clock_timestamp()::text AS requested_at, clock_timestamp() AS now'
        )) as Array<{ requested_at: string; now: Date }>
        const entries = await readEntries(manager, keys)
        signal.throwIfAborted()
        return { entries, requestedAt: clock!.requested_at, now: clock!.now }
      })
    },
    async saveAndRead(values, requestedAt, signal) {
      return source.transaction('READ COMMITTED', async (manager) => {
        signal.throwIfAborted()
        await boundStatements(manager)
        // Stable order avoids opposite lock orders when two item batches overlap.
        for (const { key, payload } of [...values].sort((a, b) =>
          JSON.stringify(a.key).localeCompare(JSON.stringify(b.key))
        )) {
          signal.throwIfAborted()
          if (key.kind === 'item') {
            await manager.query(
              `INSERT INTO item_catalog AS current
              (item_id, payload, fetched_at, expires_at, request_started_at)
              VALUES ($1, $2::jsonb, clock_timestamp(), clock_timestamp() + interval '24 hours', $3::timestamptz)
              ON CONFLICT (item_id) DO UPDATE SET payload = EXCLUDED.payload,
              fetched_at = EXCLUDED.fetched_at, expires_at = EXCLUDED.expires_at, request_started_at = EXCLUDED.request_started_at
              WHERE current.request_started_at < EXCLUDED.request_started_at`,
              [key.itemId, JSON.stringify(payload), requestedAt]
            )
          } else if (key.kind === 'set') {
            await manager.query(
              `INSERT INTO set_item_catalog AS current
              (set_item_id, payload, fetched_at, expires_at, request_started_at)
              VALUES ($1, $2::jsonb, clock_timestamp(), clock_timestamp() + interval '24 hours', $3::timestamptz)
              ON CONFLICT (set_item_id) DO UPDATE SET payload = EXCLUDED.payload,
              fetched_at = EXCLUDED.fetched_at, expires_at = EXCLUDED.expires_at, request_started_at = EXCLUDED.request_started_at
              WHERE current.request_started_at < EXCLUDED.request_started_at`,
              [key.setItemId, JSON.stringify(payload), requestedAt]
            )
          } else {
            await manager.query(
              `INSERT INTO skill_catalog AS current
              (job_id, skill_id, payload, fetched_at, expires_at, request_started_at)
              VALUES ($1, $2, $3::jsonb, clock_timestamp(), clock_timestamp() + interval '24 hours', $4::timestamptz)
              ON CONFLICT (job_id, skill_id) DO UPDATE SET payload = EXCLUDED.payload,
              fetched_at = EXCLUDED.fetched_at, expires_at = EXCLUDED.expires_at, request_started_at = EXCLUDED.request_started_at
              WHERE current.request_started_at < EXCLUDED.request_started_at`,
              [key.jobId, key.skillId, JSON.stringify(payload), requestedAt]
            )
          }
        }
        const entries = await readEntries(
          manager,
          values.map(({ key }) => key)
        )
        signal.throwIfAborted()
        const [clock] = (await manager.query('SELECT clock_timestamp() AS now')) as Array<{
          now: Date
        }>
        signal.throwIfAborted()
        return { entries, now: clock!.now }
      })
    }
  }
}

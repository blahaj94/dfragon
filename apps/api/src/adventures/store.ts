import type { DataSource } from 'typeorm'
import { NEOPLE_SERVER_NAMES } from '../constants/neople-character-search.js'
import type { AdventureSearchQuery } from './query.js'

interface StoredCharacter {
  character_id: string
  server_id: string
  character_name: unknown
  level: unknown
  job_name: unknown
  job_grow_name: unknown
  fame: unknown
  last_successful_fetch_at: Date
}

const textOrNull = (value: unknown): string | null => {
  if (typeof value === 'string') {

    return value
  }

  return null
}
const numberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {

    return value
  }

  return null
}

export function createAdventureSearchStore(source: DataSource) {

  return {
    async search(input: AdventureSearchQuery, signal: AbortSignal) {

      return source.transaction('READ COMMITTED', async (manager) => {
        signal.throwIfAborted()
        await manager.query("SET LOCAL statement_timeout = '2s'")
        signal.throwIfAborted()
        const rows = (await manager.query(
          `SELECT c.character_id, c.server_id, r.payload->'characterName' AS character_name,
             r.payload->'level' AS level, r.payload->'jobName' AS job_name,
             r.payload->'jobGrowName' AS job_grow_name, r.payload->'fame' AS fame,
             r.last_successful_fetch_at
           FROM characters AS c JOIN character_api_responses AS r
             ON r.character_id = c.character_id AND r.section = 'basic'
           WHERE c.adventure_name = $1 ${input.after == null ? '' : 'AND c.character_id > $3'}
           ORDER BY c.character_id ASC LIMIT $2`,
          input.after == null
            ? [input.adventureName, input.limit + 1]
            : [input.adventureName, input.limit + 1, input.after]
        )) as StoredCharacter[]
        signal.throwIfAborted()
        const page = rows.slice(0, input.limit)
        const adventureName = input.adventureName
        const resultRows = page.map((row) => {
          const characterId = row.character_id
          const serverId = row.server_id
          const serverName = NEOPLE_SERVER_NAMES.get(row.server_id) ?? null
          const characterName = textOrNull(row.character_name)
          const level = numberOrNull(row.level)
          const jobName = textOrNull(row.job_name)
          const jobGrowName = textOrNull(row.job_grow_name)
          const fame = numberOrNull(row.fame)
          const lastSuccessfulFetchAt = row.last_successful_fetch_at.toISOString()

          return {
            characterId,
            serverId,
            serverName,
            characterName,
            level,
            jobName,
            jobGrowName,
            fame,
            lastSuccessfulFetchAt
          }
        })
        const nextAfter = rows.length > input.limit ? page.at(-1)!.character_id : null

        return {
          adventureName,
          scope: 'stored' as const,
          rows: resultRows,
          nextAfter
        }
      })
    }
  }
}

export type AdventureSearchStore = ReturnType<typeof createAdventureSearchStore>

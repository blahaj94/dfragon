import type { DataSource } from 'typeorm'
import { CharacterApiResponseSchema } from '../../database/schemas/character-api-responses.js'
import type { CharacterApiResponse } from '../../database/schemas/character-api-responses.js'
import { CharacterDetailFailure } from './errors.js'
import { characterDetailSections } from './sections.js'
import type { CharacterIdentity, CharacterPayloads } from './sections.js'

export interface CharacterDetailStore {
  beginFetch(): Promise<string>
  saveAndRead(
    identity: CharacterIdentity,
    payloads: CharacterPayloads,
    requestedAt: string,
    signal: AbortSignal
  ): Promise<CharacterApiResponse[]>
}

export function createCharacterDetailStore(dataSource: DataSource): CharacterDetailStore {
  return {
    async beginFetch() {
      // Keep PostgreSQL microseconds as text: JS Date truncates the request ordering precision.
      const rows = (await dataSource.query(
        'SELECT clock_timestamp()::text AS requested_at'
      )) as Array<{ requested_at: string }>
      return rows[0]!.requested_at
    },
    async saveAndRead(identity, payloads, requestedAt, signal) {
      return dataSource.transaction('READ COMMITTED', async (manager) => {
        signal.throwIfAborted()
        await manager.query("SET LOCAL statement_timeout = '2s'")
        await manager.query("SET LOCAL lock_timeout = '2s'")
        await manager.query(
          `INSERT INTO characters (character_id, server_id, created_at, updated_at)
          VALUES ($1, $2, clock_timestamp(), clock_timestamp()) ON CONFLICT (character_id) DO NOTHING`,
          [identity.characterId, identity.serverId]
        )
        // All sections of a refresh are published atomically, including concurrent first inserts.
        const characters = (await manager.query(
          'SELECT server_id FROM characters WHERE character_id = $1 FOR UPDATE',
          [identity.characterId]
        )) as Array<{ server_id: string }>
        // Global ID uniqueness/server transfer is not guaranteed by the provider docs. Never merge servers silently.
        if (characters[0]?.server_id !== identity.serverId) {
          throw new CharacterDetailFailure('api')
        }
        for (const section of characterDetailSections) {
          signal.throwIfAborted()
          await manager.query(
            `INSERT INTO character_api_responses AS current
            (character_id, section, payload, revision, content_updated_at, last_successful_fetch_at, request_started_at)
            VALUES ($1, $2, $3::jsonb, 1, clock_timestamp(), clock_timestamp(), $4::timestamptz)
            ON CONFLICT (character_id, section) DO UPDATE SET
              payload = CASE WHEN current.payload IS DISTINCT FROM EXCLUDED.payload THEN EXCLUDED.payload ELSE current.payload END,
              revision = current.revision + CASE WHEN current.payload IS DISTINCT FROM EXCLUDED.payload THEN 1 ELSE 0 END,
              content_updated_at = CASE WHEN current.payload IS DISTINCT FROM EXCLUDED.payload THEN EXCLUDED.content_updated_at ELSE current.content_updated_at END,
              last_successful_fetch_at = EXCLUDED.last_successful_fetch_at,
              request_started_at = EXCLUDED.request_started_at
            WHERE current.request_started_at < EXCLUDED.request_started_at`,
            [identity.characterId, section, JSON.stringify(payloads[section]), requestedAt]
          )
        }
        // Read the committed-to-be values rather than returning the upstream body or UPDATE parameters.
        const stored = await manager
          .getRepository(CharacterApiResponseSchema)
          .findBy({ characterId: identity.characterId })
        signal.throwIfAborted()
        return stored
      })
    }
  }
}

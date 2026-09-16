import { EntitySchema } from 'typeorm'
import { characterDetailSections } from '../../characters/details/sections.js'
import type { CharacterDetailSection, CharacterPayload } from '../../characters/details/sections.js'

export interface CharacterApiResponse {
  characterId: string
  section: CharacterDetailSection
  payload: CharacterPayload
  revision: number
  contentUpdatedAt: Date
  lastSuccessfulFetchAt: Date
  requestStartedAt: Date
}

export const CharacterApiResponseSchema = new EntitySchema<CharacterApiResponse>({
  name: 'CharacterApiResponse',
  tableName: 'character_api_responses',
  columns: {
    characterId: {
      name: 'character_id',
      type: 'text',
      primary: true,
      primaryKeyConstraintName: 'pk_character_api_responses'
    },
    section: {
      type: 'enum',
      enum: characterDetailSections,
      enumName: 'character_data_section',
      primary: true,
      primaryKeyConstraintName: 'pk_character_api_responses'
    },
    payload: { type: 'jsonb' },
    revision: { type: 'integer', default: 1 },
    contentUpdatedAt: { name: 'content_updated_at', type: 'timestamptz' },
    lastSuccessfulFetchAt: { name: 'last_successful_fetch_at', type: 'timestamptz' },
    requestStartedAt: { name: 'request_started_at', type: 'timestamptz' }
  },
  foreignKeys: [
    {
      name: 'fk_character_api_responses_character',
      target: 'Character',
      columnNames: ['characterId'],
      referencedColumnNames: ['characterId'],
      onDelete: 'CASCADE'
    }
  ],
  checks: [
    {
      name: 'ck_character_api_responses_payload',
      expression: 'jsonb_typeof("payload") = \'object\''
    },
    { name: 'ck_character_api_responses_revision', expression: '"revision" > 0' }
  ]
})

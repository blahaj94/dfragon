import { EntitySchema } from 'typeorm'
import type { CharacterPayload } from '../../characters/details/sections.js'

export interface SkillCatalog {
  jobId: string
  skillId: string
  payload: CharacterPayload
  fetchedAt: Date
  expiresAt: Date
  requestStartedAt: Date
}

export const SkillCatalogSchema = new EntitySchema<SkillCatalog>({
  name: 'SkillCatalog',
  tableName: 'skill_catalog',
  columns: {
    jobId: {
      name: 'job_id',
      type: 'text',
      primary: true,
      primaryKeyConstraintName: 'pk_skill_catalog'
    },
    skillId: {
      name: 'skill_id',
      type: 'text',
      primary: true,
      primaryKeyConstraintName: 'pk_skill_catalog'
    },
    payload: { type: 'jsonb' },
    fetchedAt: { name: 'fetched_at', type: 'timestamptz' },
    expiresAt: { name: 'expires_at', type: 'timestamptz' },
    requestStartedAt: { name: 'request_started_at', type: 'timestamptz' }
  },
  checks: [
    {
      name: 'ck_skill_catalog_ids',
      expression:
        'length("job_id") BETWEEN 1 AND 256 AND "job_id" ~ \'^[a-zA-Z0-9_-]+$\' AND length("skill_id") BETWEEN 1 AND 256 AND "skill_id" ~ \'^[a-zA-Z0-9_-]+$\''
    },
    { name: 'ck_skill_catalog_payload', expression: 'jsonb_typeof("payload") = \'object\'' }
  ]
})

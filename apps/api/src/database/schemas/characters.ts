import { EntitySchema } from 'typeorm'

export interface Character {
  characterId: string
  serverId: string
  adventureName: string | null
  fame: number | null
  createdAt: Date
  updatedAt: Date
}

export const CharacterSchema = new EntitySchema<Character>({
  name: 'Character',
  tableName: 'characters',
  columns: {
    characterId: {
      name: 'character_id',
      type: 'text',
      primary: true,
      primaryKeyConstraintName: 'pk_characters'
    },
    serverId: { name: 'server_id', type: 'text' },
    createdAt: { name: 'created_at', type: 'timestamptz' },
    updatedAt: { name: 'updated_at', type: 'timestamptz' },
    adventureName: { name: 'adventure_name', type: 'text', nullable: true },
    fame: { name: 'fame', type: 'integer', nullable: true }
  },
  indices: [
    {
      name: 'idx_characters_adventure_name_character_id',
      columns: ['adventureName', 'characterId']
    },
    {
      // TypeORM cannot express the DESC key, so the migration owns this index definition.
      name: 'idx_characters_fame_character_id',
      columns: ['fame', 'characterId'],
      synchronize: false
    }
  ],
  checks: [
    { name: 'ck_characters_id', expression: 'length(btrim("character_id")) > 0' },
    { name: 'ck_characters_server', expression: 'length(btrim("server_id")) > 0' }
  ]
})

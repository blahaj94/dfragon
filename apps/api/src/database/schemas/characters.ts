import { EntitySchema } from 'typeorm'

export interface Character {
  characterId: string
  serverId: string
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
    updatedAt: { name: 'updated_at', type: 'timestamptz' }
  },
  checks: [
    { name: 'ck_characters_id', expression: 'length(btrim("character_id")) > 0' },
    { name: 'ck_characters_server', expression: 'length(btrim("server_id")) > 0' }
  ]
})

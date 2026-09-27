import { EntitySchema } from 'typeorm'

export interface User {
  id: string
  nickname: string
  createdAt: Date
}

export const UserSchema = new EntitySchema<User>({
  name: 'User',
  tableName: 'users',
  columns: {
    id: { type: 'uuid', primary: true, primaryKeyConstraintName: 'pk_users' },
    nickname: { type: 'text' },
    createdAt: { name: 'created_at', type: 'timestamptz', precision: 0 }
  },
  checks: [{ name: 'ck_users_nickname_nonempty', expression: 'char_length("nickname") > 0' }]
})

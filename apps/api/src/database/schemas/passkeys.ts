import { EntitySchema } from 'typeorm'
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server'

export interface Passkey {
  id: string
  userId: string
  publicKey: Buffer
  counter: number
  transports: AuthenticatorTransportFuture[]
  backedUp: boolean
  deviceType: 'singleDevice' | 'multiDevice'
  createdAt: Date
  lastUsedAt: Date | null
}

export const PasskeySchema = new EntitySchema<Passkey>({
  name: 'Passkey',
  tableName: 'auth_passkeys',
  columns: {
    id: { type: 'text', primary: true, primaryKeyConstraintName: 'pk_auth_passkeys' },
    userId: { name: 'user_id', type: 'uuid' },
    publicKey: { name: 'public_key', type: 'bytea' },
    counter: {
      type: 'bigint',
      transformer: { to: (value: number) => value, from: (value: string) => Number(value) }
    },
    transports: { type: 'jsonb' },
    backedUp: { name: 'backed_up', type: 'boolean' },
    deviceType: { name: 'device_type', type: 'text' },
    createdAt: { name: 'created_at', type: 'timestamptz', precision: 0 },
    lastUsedAt: { name: 'last_used_at', type: 'timestamptz', precision: 0, nullable: true }
  },
  foreignKeys: [
    {
      name: 'fk_auth_passkeys_user',
      target: 'User',
      columnNames: ['userId'],
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE'
    }
  ],
  indices: [{ name: 'idx_auth_passkeys_user', columns: ['userId'] }],
  checks: [
    { name: 'ck_auth_passkeys_id', expression: 'char_length("id") BETWEEN 1 AND 2048' },
    { name: 'ck_auth_passkeys_key', expression: 'octet_length("public_key") > 0' },
    { name: 'ck_auth_passkeys_counter', expression: '"counter" BETWEEN 0 AND 4294967295' },
    {
      name: 'ck_auth_passkeys_type',
      expression: `"device_type" IN ('singleDevice', 'multiDevice')`
    },
    {
      name: 'ck_auth_passkeys_used',
      expression: '"last_used_at" IS NULL OR "last_used_at" >= "created_at"'
    }
  ]
})

import { EntitySchema } from 'typeorm'

export interface PasskeyMigration {
  requestId: string
  phone: boolean
  sourceBindingHash: Buffer
  state: 'departing' | 'legacy' | 'returning' | 'enrolling'
  ticketHash: Buffer | null
  ticketExpiresAt: Date | null
  legacyBindingHash: Buffer | null
  challenge: string | null
  userId: string | null
  credentialId: string | null
}

/** A short-lived handoff stays bound to the initiating accounts browser and its login request. */
export const PasskeyMigrationSchema = new EntitySchema<PasskeyMigration>({
  name: 'PasskeyMigration',
  tableName: 'auth_passkey_migrations',
  columns: {
    requestId: {
      name: 'request_id',
      type: 'uuid',
      primary: true,
      primaryKeyConstraintName: 'pk_auth_passkey_migrations'
    },
    phone: { type: 'boolean' },
    sourceBindingHash: { name: 'source_binding_hash', type: 'bytea' },
    state: { type: 'text' },
    ticketHash: { name: 'ticket_hash', type: 'bytea', nullable: true },
    ticketExpiresAt: {
      name: 'ticket_expires_at',
      type: 'timestamptz',
      precision: 0,
      nullable: true
    },
    legacyBindingHash: { name: 'legacy_binding_hash', type: 'bytea', nullable: true },
    challenge: { type: 'text', nullable: true },
    userId: { name: 'user_id', type: 'uuid', nullable: true },
    credentialId: { name: 'credential_id', type: 'text', nullable: true }
  },
  foreignKeys: [
    {
      name: 'fk_auth_passkey_migrations_request',
      target: 'AuthLoginRequest',
      columnNames: ['requestId'],
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE'
    }
  ],
  indices: [
    {
      name: 'uq_auth_passkey_migrations_ticket',
      columns: ['ticketHash'],
      unique: true,
      where: '"ticket_hash" IS NOT NULL'
    }
  ],
  checks: [
    {
      name: 'ck_auth_passkey_migrations_source',
      expression: 'octet_length("source_binding_hash") = 32'
    },
    {
      name: 'ck_auth_passkey_migrations_binding',
      expression: '"legacy_binding_hash" IS NULL OR octet_length("legacy_binding_hash") = 32'
    },
    {
      name: 'ck_auth_passkey_migrations_ticket',
      expression:
        '("ticket_hash" IS NULL AND "ticket_expires_at" IS NULL) OR ("ticket_hash" IS NOT NULL AND octet_length("ticket_hash") = 32 AND "ticket_expires_at" IS NOT NULL)'
    },
    {
      name: 'ck_auth_passkey_migrations_state',
      expression: `"state" IN ('departing', 'legacy', 'returning', 'enrolling')`
    },
    {
      name: 'ck_auth_passkey_migrations_flow',
      expression: `
      ("state" = 'departing' AND "ticket_hash" IS NOT NULL AND "legacy_binding_hash" IS NULL AND "user_id" IS NULL AND "challenge" IS NULL) OR
      ("state" = 'legacy' AND "ticket_hash" IS NULL AND "legacy_binding_hash" IS NOT NULL AND "user_id" IS NULL) OR
      ("state" = 'returning' AND "ticket_hash" IS NOT NULL AND "legacy_binding_hash" IS NULL AND "user_id" IS NOT NULL AND "challenge" IS NULL) OR
      ("state" = 'enrolling' AND "ticket_hash" IS NULL AND "legacy_binding_hash" IS NULL AND "user_id" IS NOT NULL)`
    },
    {
      name: 'ck_auth_passkey_migrations_identity',
      expression: '("user_id" IS NULL) = ("credential_id" IS NULL)'
    }
  ]
})

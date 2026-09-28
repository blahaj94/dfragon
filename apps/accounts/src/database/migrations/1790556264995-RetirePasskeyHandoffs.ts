import type { MigrationInterface, QueryRunner } from 'typeorm'

export class RetirePasskeyHandoffs1790556264995 implements MigrationInterface {
  readonly name = 'RetirePasskeyHandoffs1790556264995'

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Auth schema Migration requires an active transaction')
    }
    await queryRunner.query('DROP INDEX "public"."uq_auth_passkey_migrations_ticket"')
    await queryRunner.query(
      'ALTER TABLE "auth_passkey_migrations" DROP CONSTRAINT "fk_auth_passkey_migrations_request"'
    )
    await queryRunner.query('DROP TABLE "auth_passkey_migrations"')
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Auth schema Migration requires an active transaction')
    }
    await queryRunner.query(
      'CREATE TABLE "auth_passkey_migrations" ("request_id" uuid NOT NULL, "phone" boolean NOT NULL, "source_binding_hash" bytea NOT NULL, "state" text NOT NULL, "ticket_hash" bytea, "ticket_expires_at" TIMESTAMP(0) WITH TIME ZONE, "legacy_binding_hash" bytea, "challenge" text, "user_id" uuid, "credential_id" text, CONSTRAINT "ck_auth_passkey_migrations_source" CHECK ((octet_length(source_binding_hash) = 32)), CONSTRAINT "ck_auth_passkey_migrations_binding" CHECK (((legacy_binding_hash IS NULL) OR (octet_length(legacy_binding_hash) = 32))), CONSTRAINT "ck_auth_passkey_migrations_ticket" CHECK ((((ticket_hash IS NULL) AND (ticket_expires_at IS NULL)) OR ((ticket_hash IS NOT NULL) AND (octet_length(ticket_hash) = 32) AND (ticket_expires_at IS NOT NULL)))), CONSTRAINT "ck_auth_passkey_migrations_state" CHECK ((state = ANY (ARRAY[\'departing\'::text, \'legacy\'::text, \'returning\'::text, \'enrolling\'::text]))), CONSTRAINT "ck_auth_passkey_migrations_flow" CHECK ((((state = \'departing\'::text) AND (ticket_hash IS NOT NULL) AND (legacy_binding_hash IS NULL) AND (user_id IS NULL) AND (challenge IS NULL)) OR ((state = \'legacy\'::text) AND (ticket_hash IS NULL) AND (legacy_binding_hash IS NOT NULL) AND (user_id IS NULL)) OR ((state = \'returning\'::text) AND (ticket_hash IS NOT NULL) AND (legacy_binding_hash IS NULL) AND (user_id IS NOT NULL) AND (challenge IS NULL)) OR ((state = \'enrolling\'::text) AND (ticket_hash IS NULL) AND (legacy_binding_hash IS NULL) AND (user_id IS NOT NULL)))), CONSTRAINT "ck_auth_passkey_migrations_identity" CHECK (((user_id IS NULL) = (credential_id IS NULL))), CONSTRAINT "fk_auth_passkey_migrations_request" FOREIGN KEY ("request_id") REFERENCES "auth_login_requests" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "pk_auth_passkey_migrations" PRIMARY KEY ("request_id"))'
    )
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_auth_passkey_migrations_ticket" ON "auth_passkey_migrations" USING btree ("ticket_hash") WHERE (ticket_hash IS NOT NULL)'
    )
  }
}

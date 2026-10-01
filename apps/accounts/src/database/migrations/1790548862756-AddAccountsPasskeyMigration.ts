import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAccountsPasskeyMigration1790548862756 implements MigrationInterface {
  readonly name = 'AddAccountsPasskeyMigration1790548862756'

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Auth schema Migration requires an active transaction')
    }
    await queryRunner.query(
      'CREATE TABLE "auth_passkey_migrations" ("request_id" uuid NOT NULL, "phone" boolean NOT NULL, "source_binding_hash" bytea NOT NULL, "state" text NOT NULL, "ticket_hash" bytea, "ticket_expires_at" TIMESTAMP(0) WITH TIME ZONE, "legacy_binding_hash" bytea, "challenge" text, "user_id" uuid, "credential_id" text, CONSTRAINT "ck_auth_passkey_migrations_source" CHECK (octet_length("source_binding_hash") = 32), CONSTRAINT "ck_auth_passkey_migrations_binding" CHECK ("legacy_binding_hash" IS NULL OR octet_length("legacy_binding_hash") = 32), CONSTRAINT "ck_auth_passkey_migrations_ticket" CHECK (("ticket_hash" IS NULL AND "ticket_expires_at" IS NULL) OR ("ticket_hash" IS NOT NULL AND octet_length("ticket_hash") = 32 AND "ticket_expires_at" IS NOT NULL)), CONSTRAINT "ck_auth_passkey_migrations_state" CHECK ("state" IN (\'departing\', \'legacy\', \'returning\', \'enrolling\')), CONSTRAINT "ck_auth_passkey_migrations_flow" CHECK (\n      ("state" = \'departing\' AND "ticket_hash" IS NOT NULL AND "legacy_binding_hash" IS NULL AND "user_id" IS NULL AND "challenge" IS NULL) OR\n      ("state" = \'legacy\' AND "ticket_hash" IS NULL AND "legacy_binding_hash" IS NOT NULL AND "user_id" IS NULL) OR\n      ("state" = \'returning\' AND "ticket_hash" IS NOT NULL AND "legacy_binding_hash" IS NULL AND "user_id" IS NOT NULL AND "challenge" IS NULL) OR\n      ("state" = \'enrolling\' AND "ticket_hash" IS NULL AND "legacy_binding_hash" IS NULL AND "user_id" IS NOT NULL)), CONSTRAINT "ck_auth_passkey_migrations_identity" CHECK (("user_id" IS NULL) = ("credential_id" IS NULL)), CONSTRAINT "pk_auth_passkey_migrations" PRIMARY KEY ("request_id"))'
    )
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_auth_passkey_migrations_ticket" ON "auth_passkey_migrations"  ("ticket_hash") WHERE "ticket_hash" IS NOT NULL'
    )
    await queryRunner.query('ALTER TABLE "auth_passkeys" ADD "rp_id" text NOT NULL')
    await queryRunner.query(
      'ALTER TABLE "auth_passkeys" ADD CONSTRAINT "ck_auth_passkeys_rp" CHECK (char_length("rp_id") BETWEEN 1 AND 253)'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_passkey_migrations" ADD CONSTRAINT "fk_auth_passkey_migrations_request" FOREIGN KEY ("request_id") REFERENCES "auth_login_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION'
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Auth schema Migration requires an active transaction')
    }
    // Dropping RP metadata on populated databases would make stored credentials unusable.

    if (
      (await queryRunner.query('SELECT 1 FROM auth_passkeys LIMIT 1')).length > 0 ||
      (await queryRunner.query('SELECT 1 FROM auth_passkey_migrations LIMIT 1')).length > 0
    ) {
      throw new Error('Accounts schema rollback requires empty passkey tables')
    }
    await queryRunner.query(
      'ALTER TABLE "auth_passkey_migrations" DROP CONSTRAINT "fk_auth_passkey_migrations_request"'
    )
    await queryRunner.query('ALTER TABLE "auth_passkeys" DROP CONSTRAINT "ck_auth_passkeys_rp"')
    await queryRunner.query('ALTER TABLE "auth_passkeys" DROP COLUMN "rp_id"')
    await queryRunner.query('DROP INDEX "public"."uq_auth_passkey_migrations_ticket"')
    await queryRunner.query('DROP TABLE "auth_passkey_migrations"')
  }
}

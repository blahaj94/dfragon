import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPhoneQrLogin1789601588410 implements MigrationInterface {
  readonly name = 'AddPhoneQrLogin1789601588410'

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Auth schema Migration requires an active transaction')
    }
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_status"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_terminal"'
    )
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "qr_ticket_hash" bytea')
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "uq_auth_login_requests_qr_ticket_hash" UNIQUE ("qr_ticket_hash")'
    )
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "phone_binding_hash" bytea')
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "confirmation_code" text')
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_phone_fields" CHECK (("confirmation_code" IS NULL AND "qr_ticket_hash" IS NULL AND "phone_binding_hash" IS NULL AND "status" NOT IN (\'phone_verified\',\'phone_approved\')) OR ("confirmation_code" IS NOT NULL AND "confirmation_code" ~ \'^[0-9]{6}$\' AND "purpose" = \'login\' AND "code_challenge" IS NOT NULL AND "browser_binding_hash" IS NOT NULL AND "status" IN (\'browser_started\',\'phone_verified\',\'phone_approved\') AND "launch_ticket_hash" IS NULL AND "exchange_code_hash" IS NULL AND (("qr_ticket_hash" IS NOT NULL AND "phone_binding_hash" IS NULL) OR ("qr_ticket_hash" IS NULL AND "phone_binding_hash" IS NOT NULL))))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_phone_verified" CHECK ("status" NOT IN (\'phone_verified\',\'phone_approved\') OR ("phone_binding_hash" IS NOT NULL AND "verified_user_id" IS NOT NULL AND "credential_id" IS NOT NULL AND "webauthn_challenge" IS NULL AND "operation" IS NULL AND "pending_user_id" IS NULL))'
    )
    await queryRunner.query(
      "ALTER TABLE \"auth_login_requests\" ADD CONSTRAINT \"ck_passkey_request_status_phone\" CHECK (\"status\" IN ('created','browser_started','phone_verified','phone_approved','exchange_ready','managing','consumed','failed'))"
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_qr_ticket_hash" CHECK ("qr_ticket_hash" IS NULL OR octet_length("qr_ticket_hash") = 32)'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_phone_binding_hash" CHECK ("phone_binding_hash" IS NULL OR octet_length("phone_binding_hash") = 32)'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_terminal_phone" CHECK ("status" NOT IN (\'consumed\',\'failed\') OR ("code_challenge" IS NULL AND "launch_ticket_hash" IS NULL AND "browser_binding_hash" IS NULL\n AND "qr_ticket_hash" IS NULL AND "phone_binding_hash" IS NULL AND "confirmation_code" IS NULL\n AND "webauthn_challenge" IS NULL AND "operation" IS NULL AND "pending_user_id" IS NULL\n AND "verified_user_id" IS NULL AND "credential_id" IS NULL AND "exchange_code_hash" IS NULL AND "code_expires_at" IS NULL))'
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // A rollback must not turn an in-progress phone request into a direct browser grant.
    // Production uses forward migrations; disposable rollback requires no active QR requests.
    if (!queryRunner.isTransactionActive) {
      throw new Error('Auth schema Migration requires an active transaction')
    }
    await queryRunner.query('LOCK TABLE "auth_login_requests" IN ACCESS EXCLUSIVE MODE')
    await queryRunner.query(
      `DO $$ BEGIN IF EXISTS (SELECT 1 FROM auth_login_requests WHERE confirmation_code IS NOT NULL) THEN RAISE EXCEPTION 'Active phone login requests prevent rollback'; END IF; END $$`
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_terminal_phone"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_phone_binding_hash"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_qr_ticket_hash"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_status_phone"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_phone_verified"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_phone_fields"'
    )
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "confirmation_code"')
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "phone_binding_hash"')
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "uq_auth_login_requests_qr_ticket_hash"'
    )
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "qr_ticket_hash"')
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_terminal" CHECK (((status <> ALL (ARRAY[\'consumed\'::text, \'failed\'::text])) OR ((code_challenge IS NULL) AND (launch_ticket_hash IS NULL) AND (browser_binding_hash IS NULL) AND (webauthn_challenge IS NULL) AND (operation IS NULL) AND (pending_user_id IS NULL) AND (verified_user_id IS NULL) AND (credential_id IS NULL) AND (exchange_code_hash IS NULL) AND (code_expires_at IS NULL))))'
    )
    await queryRunner.query(
      "ALTER TABLE \"auth_login_requests\" ADD CONSTRAINT \"ck_passkey_request_status\" CHECK ((status = ANY (ARRAY['created'::text, 'browser_started'::text, 'exchange_ready'::text, 'managing'::text, 'consumed'::text, 'failed'::text])))"
    )
  }
}

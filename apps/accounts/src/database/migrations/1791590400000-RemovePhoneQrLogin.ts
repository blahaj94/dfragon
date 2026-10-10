import type { MigrationInterface, QueryRunner } from 'typeorm'

export class RemovePhoneQrLogin1791590400000 implements MigrationInterface {
  readonly name = 'RemovePhoneQrLogin1791590400000'

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Auth schema Migration requires an active transaction')
    }
    // QR 인증이 직접 로그인 권한으로 바뀌지 않도록 쓰기를 막고 먼저 실패로 종료한다.
    await queryRunner.query('LOCK TABLE "auth_login_requests" IN ACCESS EXCLUSIVE MODE')
    await queryRunner.query(`
      UPDATE "auth_login_requests"
      SET "status" = 'failed', "code_challenge" = NULL, "launch_ticket_hash" = NULL,
          "browser_binding_hash" = NULL, "qr_ticket_hash" = NULL, "phone_binding_hash" = NULL,
          "confirmation_code" = NULL, "webauthn_challenge" = NULL, "operation" = NULL,
          "pending_user_id" = NULL, "verified_user_id" = NULL, "credential_id" = NULL,
          "exchange_code_hash" = NULL, "code_expires_at" = NULL, "consumed_at" = NULL
      WHERE "qr_ticket_hash" IS NOT NULL OR "phone_binding_hash" IS NOT NULL
         OR "confirmation_code" IS NOT NULL OR "status" IN ('phone_verified', 'phone_approved')
    `)
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
      `ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_status_direct" CHECK ("status" IN ('created','browser_started','exchange_ready','managing','consumed','failed'))`
    )
    await queryRunner.query(
      `ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_terminal_direct" CHECK ("status" NOT IN ('consumed','failed') OR ("code_challenge" IS NULL AND "launch_ticket_hash" IS NULL AND "browser_binding_hash" IS NULL
 AND "webauthn_challenge" IS NULL AND "operation" IS NULL AND "pending_user_id" IS NULL
 AND "verified_user_id" IS NULL AND "credential_id" IS NULL AND "exchange_code_hash" IS NULL AND "code_expires_at" IS NULL))`
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Auth schema Migration requires an active transaction')
    }
    // Disposable rollback은 nullable 구조만 복원하며 종료된 요청과 QR proof를 되살리지 않는다.
    await queryRunner.query('LOCK TABLE "auth_login_requests" IN ACCESS EXCLUSIVE MODE')
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_status_direct"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_terminal_direct"'
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
}

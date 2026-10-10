import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddLoginReturnUrl1791590400001 implements MigrationInterface {
  readonly name = 'AddLoginReturnUrl1791590400001'

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Auth schema Migration requires an active transaction')
    }
    await queryRunner.query('LOCK TABLE "auth_login_requests" IN ACCESS EXCLUSIVE MODE')
    // 임시 포트는 복원할 수 없고 설정 fingerprint도 바뀌므로 기존 인증 요청을 종료한다.
    await queryRunner.query(`
      UPDATE "auth_login_requests"
      SET "status" = 'failed', "code_challenge" = NULL, "launch_ticket_hash" = NULL,
          "browser_binding_hash" = NULL, "webauthn_challenge" = NULL, "operation" = NULL,
          "pending_user_id" = NULL, "verified_user_id" = NULL, "credential_id" = NULL,
          "exchange_code_hash" = NULL, "code_expires_at" = NULL, "consumed_at" = NULL
      WHERE "status" NOT IN ('consumed', 'failed')
    `)
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "return_url" text')
    await queryRunner.query(
      `ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_return_url" CHECK ("return_url" IS NULL OR CASE WHEN "return_url" ~ '^http://127[.]0[.]0[.]1:[1-9][0-9]{3,4}/auth/callback$' THEN split_part(split_part("return_url", ':', 3), '/', 1)::integer BETWEEN 1024 AND 65535 ELSE false END)`
    )
    await queryRunner.query(
      `ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_return_url_state" CHECK ("return_url" IS NULL OR ("purpose" = 'login' AND "status" NOT IN ('consumed','failed')))`
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Auth schema Migration requires an active transaction')
    }
    // Disposable down은 구조만 되돌리며 종료된 요청을 복구하지 않는다.
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_return_url_state"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_return_url"'
    )
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "return_url"')
  }
}

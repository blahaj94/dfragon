import type { MigrationInterface, QueryRunner } from 'typeorm'

export class ReplaceOAuthWithPasskeys1789566809748 implements MigrationInterface {
  readonly name = 'ReplaceOAuthWithPasskeys1789566809748'

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Auth schema Migration requires an active transaction')
    }
    await queryRunner.query('LOCK TABLE auth_login_requests, users IN ACCESS EXCLUSIVE MODE')
    await queryRunner.query(
      `DO $$ BEGIN IF EXISTS (SELECT 1 FROM users) OR EXISTS (SELECT 1 FROM auth_login_requests) THEN RAISE EXCEPTION 'Passkey migration requires empty authentication tables'; END IF; END $$`
    )
    await queryRunner.query('ALTER TABLE "users" DROP CONSTRAINT "ck_users_provider"')
    await queryRunner.query(
      'ALTER TABLE "users" DROP CONSTRAINT "ck_users_provider_subject_nonempty"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_purpose"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_provider"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_client"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_config_nonempty"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_return_target_nonempty"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_status"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_method"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_code_challenge_nonempty"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_launch_hash_length"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_state_hash_length"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_browser_hash_length"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_nonce_hash_length"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_exchange_hash_length"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_pkce_fields"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_subject_nonempty"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_created_fields"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_browser_started_fields"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_processing_fields"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_exchange_ready_fields"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_consumed_fields"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_auth_login_requests_failed_fields"'
    )
    await queryRunner.query('ALTER TABLE "users" DROP CONSTRAINT "uq_users_provider_subject"')
    await queryRunner.query(
      'CREATE TABLE "auth_passkeys" ("id" text NOT NULL, "user_id" uuid NOT NULL, "public_key" bytea NOT NULL, "counter" bigint NOT NULL, "transports" jsonb NOT NULL, "backed_up" boolean NOT NULL, "device_type" text NOT NULL, "created_at" TIMESTAMP(0) WITH TIME ZONE NOT NULL, "last_used_at" TIMESTAMP(0) WITH TIME ZONE, CONSTRAINT "ck_auth_passkeys_id" CHECK (char_length("id") BETWEEN 1 AND 2048), CONSTRAINT "ck_auth_passkeys_key" CHECK (octet_length("public_key") > 0), CONSTRAINT "ck_auth_passkeys_counter" CHECK ("counter" BETWEEN 0 AND 4294967295), CONSTRAINT "ck_auth_passkeys_type" CHECK ("device_type" IN (\'singleDevice\', \'multiDevice\')), CONSTRAINT "ck_auth_passkeys_used" CHECK ("last_used_at" IS NULL OR "last_used_at" >= "created_at"), CONSTRAINT "pk_auth_passkeys" PRIMARY KEY ("id"))'
    )
    await queryRunner.query(
      'CREATE INDEX "idx_auth_passkeys_user" ON "auth_passkeys"  ("user_id") '
    )
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "provider"')
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "provider_subject"')
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "provider"')
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "client_id"')
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP COLUMN "provider_config_version"'
    )
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "return_target_id"')
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "method"')
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "uq_auth_login_requests_state_hash"'
    )
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "state_hash"')
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "oidc_nonce_hash"')
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP COLUMN "provider_pkce_ciphertext"'
    )
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "provider_pkce_iv"')
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "provider_pkce_tag"')
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "provider_pkce_key_id"')
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "verified_subject"')
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "configuration" text NOT NULL')
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "webauthn_challenge" text')
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "operation" text')
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "pending_user_id" uuid')
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "verified_user_id" uuid')
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "credential_id" text')
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "is_new_user" boolean NOT NULL')
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_purpose" CHECK ("purpose" IN (\'login\', \'manage\'))'
    )
    await queryRunner.query(
      "ALTER TABLE \"auth_login_requests\" ADD CONSTRAINT \"ck_passkey_request_status\" CHECK (\"status\" IN ('created','browser_started','exchange_ready','managing','consumed','failed'))"
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_configuration" CHECK (char_length("configuration") = 64)'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_launch_ticket_hash" CHECK ("launch_ticket_hash" IS NULL OR octet_length("launch_ticket_hash") = 32)'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_browser_binding_hash" CHECK ("browser_binding_hash" IS NULL OR octet_length("browser_binding_hash") = 32)'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_exchange_code_hash" CHECK ("exchange_code_hash" IS NULL OR octet_length("exchange_code_hash") = 32)'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_challenge" CHECK (("webauthn_challenge" IS NULL AND "operation" IS NULL AND "pending_user_id" IS NULL) OR ("webauthn_challenge" IS NOT NULL AND "operation" IS NOT NULL AND "operation" IN (\'register\',\'authenticate\',\'add\')))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_created" CHECK ("status" <> \'created\' OR ("purpose" = \'login\' AND "code_challenge" IS NOT NULL AND "launch_ticket_hash" IS NOT NULL AND "browser_binding_hash" IS NULL AND "verified_user_id" IS NULL AND "exchange_code_hash" IS NULL))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_browser" CHECK ("status" <> \'browser_started\' OR ("launch_ticket_hash" IS NULL AND "browser_binding_hash" IS NOT NULL AND "verified_user_id" IS NULL AND "exchange_code_hash" IS NULL))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_ready" CHECK ("status" <> \'exchange_ready\' OR ("purpose" = \'login\' AND "code_challenge" IS NOT NULL AND "verified_user_id" IS NOT NULL AND "credential_id" IS NOT NULL AND "exchange_code_hash" IS NOT NULL AND "code_expires_at" IS NOT NULL AND "browser_binding_hash" IS NULL AND "webauthn_challenge" IS NULL))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_managing" CHECK ("status" <> \'managing\' OR ("purpose" = \'manage\' AND "browser_binding_hash" IS NOT NULL AND "verified_user_id" IS NOT NULL AND "credential_id" IS NOT NULL AND "code_challenge" IS NULL AND "exchange_code_hash" IS NULL))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_terminal" CHECK ("status" NOT IN (\'consumed\',\'failed\') OR ("code_challenge" IS NULL AND "launch_ticket_hash" IS NULL AND "browser_binding_hash" IS NULL\n AND "webauthn_challenge" IS NULL AND "operation" IS NULL AND "pending_user_id" IS NULL\n AND "verified_user_id" IS NULL AND "credential_id" IS NULL AND "exchange_code_hash" IS NULL AND "code_expires_at" IS NULL))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_passkey_request_consumed" CHECK (("status" = \'consumed\') = ("consumed_at" IS NOT NULL))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_passkeys" ADD CONSTRAINT "fk_auth_passkeys_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION'
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Auth schema Migration requires an active transaction')
    }
    await queryRunner.query('LOCK TABLE auth_login_requests, users IN ACCESS EXCLUSIVE MODE')
    await queryRunner.query(
      `DO $$ BEGIN IF EXISTS (SELECT 1 FROM users) OR EXISTS (SELECT 1 FROM auth_login_requests) THEN RAISE EXCEPTION 'Passkey migration requires empty authentication tables'; END IF; END $$`
    )
    await queryRunner.query('ALTER TABLE "auth_passkeys" DROP CONSTRAINT "fk_auth_passkeys_user"')
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_consumed"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_terminal"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_managing"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_ready"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_browser"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_created"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_challenge"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_exchange_code_hash"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_browser_binding_hash"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_launch_ticket_hash"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_configuration"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_status"'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" DROP CONSTRAINT "ck_passkey_request_purpose"'
    )
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "is_new_user"')
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "credential_id"')
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "verified_user_id"')
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "pending_user_id"')
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "operation"')
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "webauthn_challenge"')
    await queryRunner.query('ALTER TABLE "auth_login_requests" DROP COLUMN "configuration"')
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "verified_subject" text')
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "provider_pkce_key_id" text')
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "provider_pkce_tag" bytea')
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "provider_pkce_iv" bytea')
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD "provider_pkce_ciphertext" bytea'
    )
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "oidc_nonce_hash" bytea')
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "state_hash" bytea')
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "uq_auth_login_requests_state_hash" UNIQUE ("state_hash")'
    )
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "method" text')
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD "return_target_id" text NOT NULL'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD "provider_config_version" text NOT NULL'
    )
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "client_id" text NOT NULL')
    await queryRunner.query('ALTER TABLE "auth_login_requests" ADD "provider" text NOT NULL')
    await queryRunner.query('ALTER TABLE "users" ADD "provider_subject" text COLLATE "C" NOT NULL')
    await queryRunner.query('ALTER TABLE "users" ADD "provider" text NOT NULL')
    await queryRunner.query('DROP INDEX "public"."idx_auth_passkeys_user"')
    await queryRunner.query('DROP TABLE "auth_passkeys"')
    await queryRunner.query(
      'ALTER TABLE "users" ADD CONSTRAINT "uq_users_provider_subject" UNIQUE ("provider", "provider_subject")'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_failed_fields" CHECK (((status <> \'failed\'::text) OR ((code_challenge IS NULL) AND (method IS NULL) AND (launch_ticket_hash IS NULL) AND (state_hash IS NULL) AND (browser_binding_hash IS NULL) AND (oidc_nonce_hash IS NULL) AND (provider_pkce_ciphertext IS NULL) AND (provider_pkce_iv IS NULL) AND (provider_pkce_tag IS NULL) AND (provider_pkce_key_id IS NULL) AND (verified_subject IS NULL) AND (exchange_code_hash IS NULL) AND (code_expires_at IS NULL) AND (consumed_at IS NULL))))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_consumed_fields" CHECK (((status <> \'consumed\'::text) OR ((code_challenge IS NULL) AND (method IS NULL) AND (launch_ticket_hash IS NULL) AND (state_hash IS NULL) AND (browser_binding_hash IS NULL) AND (oidc_nonce_hash IS NULL) AND (provider_pkce_ciphertext IS NULL) AND (provider_pkce_iv IS NULL) AND (provider_pkce_tag IS NULL) AND (provider_pkce_key_id IS NULL) AND (verified_subject IS NULL) AND (exchange_code_hash IS NULL) AND (code_expires_at IS NULL) AND (consumed_at IS NOT NULL))))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_exchange_ready_fields" CHECK (((status <> \'exchange_ready\'::text) OR ((code_challenge IS NOT NULL) AND (method IS NOT NULL) AND (method = \'S256\'::text) AND (launch_ticket_hash IS NULL) AND (verified_subject IS NOT NULL) AND (exchange_code_hash IS NOT NULL) AND (code_expires_at IS NOT NULL) AND (consumed_at IS NULL))))'
    )
    await queryRunner.query(
      "ALTER TABLE \"auth_login_requests\" ADD CONSTRAINT \"ck_auth_login_requests_processing_fields\" CHECK (((status <> 'processing'::text) OR ((code_challenge IS NOT NULL) AND (method IS NOT NULL) AND (method = 'S256'::text) AND (launch_ticket_hash IS NULL) AND (state_hash IS NOT NULL) AND (browser_binding_hash IS NOT NULL) AND ((provider <> 'google'::text) OR (oidc_nonce_hash IS NOT NULL)) AND (provider_pkce_ciphertext IS NOT NULL) AND (provider_pkce_iv IS NOT NULL) AND (provider_pkce_tag IS NOT NULL) AND (provider_pkce_key_id IS NOT NULL) AND (verified_subject IS NULL) AND (exchange_code_hash IS NULL) AND (code_expires_at IS NULL) AND (consumed_at IS NULL))))"
    )
    await queryRunner.query(
      "ALTER TABLE \"auth_login_requests\" ADD CONSTRAINT \"ck_auth_login_requests_browser_started_fields\" CHECK (((status <> 'browser_started'::text) OR ((code_challenge IS NOT NULL) AND (method IS NOT NULL) AND (method = 'S256'::text) AND (launch_ticket_hash IS NULL) AND (state_hash IS NOT NULL) AND (browser_binding_hash IS NOT NULL) AND ((provider <> 'google'::text) OR (oidc_nonce_hash IS NOT NULL)) AND (provider_pkce_ciphertext IS NOT NULL) AND (provider_pkce_iv IS NOT NULL) AND (provider_pkce_tag IS NOT NULL) AND (provider_pkce_key_id IS NOT NULL) AND (verified_subject IS NULL) AND (exchange_code_hash IS NULL) AND (code_expires_at IS NULL) AND (consumed_at IS NULL))))"
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_created_fields" CHECK (((status <> \'created\'::text) OR ((code_challenge IS NOT NULL) AND (method IS NOT NULL) AND (method = \'S256\'::text) AND (launch_ticket_hash IS NOT NULL) AND (state_hash IS NULL) AND (browser_binding_hash IS NULL) AND (oidc_nonce_hash IS NULL) AND (provider_pkce_ciphertext IS NULL) AND (provider_pkce_iv IS NULL) AND (provider_pkce_tag IS NULL) AND (provider_pkce_key_id IS NULL) AND (verified_subject IS NULL) AND (exchange_code_hash IS NULL) AND (code_expires_at IS NULL) AND (consumed_at IS NULL))))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_subject_nonempty" CHECK (((verified_subject IS NULL) OR (char_length(verified_subject) > 0)))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_pkce_fields" CHECK ((((provider_pkce_ciphertext IS NULL) AND (provider_pkce_iv IS NULL) AND (provider_pkce_tag IS NULL) AND (provider_pkce_key_id IS NULL)) OR ((provider_pkce_ciphertext IS NOT NULL) AND (provider_pkce_iv IS NOT NULL) AND (provider_pkce_tag IS NOT NULL) AND (provider_pkce_key_id IS NOT NULL) AND (octet_length(provider_pkce_ciphertext) > 0) AND (octet_length(provider_pkce_iv) = 12) AND (octet_length(provider_pkce_tag) = 16) AND (char_length(provider_pkce_key_id) > 0))))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_exchange_hash_length" CHECK (((exchange_code_hash IS NULL) OR (octet_length(exchange_code_hash) = 32)))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_nonce_hash_length" CHECK (((oidc_nonce_hash IS NULL) OR (octet_length(oidc_nonce_hash) = 32)))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_browser_hash_length" CHECK (((browser_binding_hash IS NULL) OR (octet_length(browser_binding_hash) = 32)))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_state_hash_length" CHECK (((state_hash IS NULL) OR (octet_length(state_hash) = 32)))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_launch_hash_length" CHECK (((launch_ticket_hash IS NULL) OR (octet_length(launch_ticket_hash) = 32)))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_code_challenge_nonempty" CHECK (((code_challenge IS NULL) OR (char_length(code_challenge) > 0)))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_method" CHECK (((method IS NULL) OR (method = \'S256\'::text)))'
    )
    await queryRunner.query(
      "ALTER TABLE \"auth_login_requests\" ADD CONSTRAINT \"ck_auth_login_requests_status\" CHECK ((status = ANY (ARRAY['created'::text, 'browser_started'::text, 'processing'::text, 'exchange_ready'::text, 'consumed'::text, 'failed'::text])))"
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_return_target_nonempty" CHECK ((char_length(return_target_id) > 0))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_config_nonempty" CHECK ((char_length(provider_config_version) > 0))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_client" CHECK ((client_id = \'desktop\'::text))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_provider" CHECK ((provider = ANY (ARRAY[\'google\'::text, \'discord\'::text])))'
    )
    await queryRunner.query(
      'ALTER TABLE "auth_login_requests" ADD CONSTRAINT "ck_auth_login_requests_purpose" CHECK ((purpose = \'login\'::text))'
    )
    await queryRunner.query(
      'ALTER TABLE "users" ADD CONSTRAINT "ck_users_provider_subject_nonempty" CHECK ((char_length(provider_subject) > 0))'
    )
    await queryRunner.query(
      'ALTER TABLE "users" ADD CONSTRAINT "ck_users_provider" CHECK ((provider = ANY (ARRAY[\'google\'::text, \'discord\'::text])))'
    )
  }
}

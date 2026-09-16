import { EntitySchema } from 'typeorm'

export interface AuthLoginRequest {
  id: string
  purpose: 'login' | 'manage'
  configuration: string
  createdAt: Date
  expiresAt: Date
  status: 'created' | 'browser_started' | 'exchange_ready' | 'managing' | 'consumed' | 'failed'
  codeChallenge: string | null
  launchTicketHash: Buffer | null
  browserBindingHash: Buffer | null
  webauthnChallenge: string | null
  operation: 'register' | 'authenticate' | 'add' | null
  pendingUserId: string | null
  verifiedUserId: string | null
  credentialId: string | null
  isNewUser: boolean
  exchangeCodeHash: Buffer | null
  codeExpiresAt: Date | null
  consumedAt: Date | null
}
const binary = { type: 'bytea' as const, nullable: true }
const time = { type: 'timestamptz' as const, precision: 0 }
const cleared = `"code_challenge" IS NULL AND "launch_ticket_hash" IS NULL AND "browser_binding_hash" IS NULL
 AND "webauthn_challenge" IS NULL AND "operation" IS NULL AND "pending_user_id" IS NULL
 AND "verified_user_id" IS NULL AND "credential_id" IS NULL AND "exchange_code_hash" IS NULL AND "code_expires_at" IS NULL`

export const AuthLoginRequestSchema = new EntitySchema<AuthLoginRequest>({
  name: 'AuthLoginRequest',
  tableName: 'auth_login_requests',
  columns: {
    id: { type: 'uuid', primary: true, primaryKeyConstraintName: 'pk_auth_login_requests' },
    purpose: { type: 'text' },
    configuration: { type: 'text' },
    createdAt: { name: 'created_at', ...time },
    expiresAt: { name: 'expires_at', ...time },
    status: { type: 'text' },
    codeChallenge: { name: 'code_challenge', type: 'text', nullable: true },
    launchTicketHash: { name: 'launch_ticket_hash', ...binary },
    browserBindingHash: { name: 'browser_binding_hash', ...binary },
    webauthnChallenge: { name: 'webauthn_challenge', type: 'text', nullable: true },
    operation: { type: 'text', nullable: true },
    pendingUserId: { name: 'pending_user_id', type: 'uuid', nullable: true },
    verifiedUserId: { name: 'verified_user_id', type: 'uuid', nullable: true },
    credentialId: { name: 'credential_id', type: 'text', nullable: true },
    isNewUser: { name: 'is_new_user', type: 'boolean' },
    exchangeCodeHash: { name: 'exchange_code_hash', ...binary },
    codeExpiresAt: { name: 'code_expires_at', ...time, nullable: true },
    consumedAt: { name: 'consumed_at', ...time, nullable: true }
  },
  uniques: [
    { name: 'uq_auth_login_requests_launch_ticket_hash', columns: ['launchTicketHash'] },
    { name: 'uq_auth_login_requests_exchange_code_hash', columns: ['exchangeCodeHash'] }
  ],
  indices: [{ name: 'idx_auth_login_requests_expires_at', columns: ['expiresAt'] }],
  checks: [
    { name: 'ck_passkey_request_purpose', expression: `"purpose" IN ('login', 'manage')` },
    {
      name: 'ck_passkey_request_status',
      expression: `"status" IN ('created','browser_started','exchange_ready','managing','consumed','failed')`
    },
    { name: 'ck_passkey_request_configuration', expression: 'char_length("configuration") = 64' },
    { name: 'ck_auth_login_requests_expiry', expression: '"expires_at" > "created_at"' },
    {
      name: 'ck_auth_login_requests_code_deadline',
      expression: '"code_expires_at" IS NULL OR "code_expires_at" <= "expires_at"'
    },
    ...['launch_ticket_hash', 'browser_binding_hash', 'exchange_code_hash'].map((field) => ({
      name: `ck_passkey_request_${field}`,
      expression: `"${field}" IS NULL OR octet_length("${field}") = 32`
    })),
    {
      name: 'ck_passkey_request_challenge',
      expression: `("webauthn_challenge" IS NULL AND "operation" IS NULL AND "pending_user_id" IS NULL) OR ("webauthn_challenge" IS NOT NULL AND "operation" IS NOT NULL AND "operation" IN ('register','authenticate','add'))`
    },
    {
      name: 'ck_passkey_request_created',
      expression: `"status" <> 'created' OR ("purpose" = 'login' AND "code_challenge" IS NOT NULL AND "launch_ticket_hash" IS NOT NULL AND "browser_binding_hash" IS NULL AND "verified_user_id" IS NULL AND "exchange_code_hash" IS NULL)`
    },
    {
      name: 'ck_passkey_request_browser',
      expression: `"status" <> 'browser_started' OR ("launch_ticket_hash" IS NULL AND "browser_binding_hash" IS NOT NULL AND "verified_user_id" IS NULL AND "exchange_code_hash" IS NULL)`
    },
    {
      name: 'ck_passkey_request_ready',
      expression: `"status" <> 'exchange_ready' OR ("purpose" = 'login' AND "code_challenge" IS NOT NULL AND "verified_user_id" IS NOT NULL AND "credential_id" IS NOT NULL AND "exchange_code_hash" IS NOT NULL AND "code_expires_at" IS NOT NULL AND "browser_binding_hash" IS NULL AND "webauthn_challenge" IS NULL)`
    },
    {
      name: 'ck_passkey_request_managing',
      expression: `"status" <> 'managing' OR ("purpose" = 'manage' AND "browser_binding_hash" IS NOT NULL AND "verified_user_id" IS NOT NULL AND "credential_id" IS NOT NULL AND "code_challenge" IS NULL AND "exchange_code_hash" IS NULL)`
    },
    {
      name: 'ck_passkey_request_terminal',
      expression: `"status" NOT IN ('consumed','failed') OR (${cleared})`
    },
    {
      name: 'ck_passkey_request_consumed',
      expression: `("status" = 'consumed') = ("consumed_at" IS NOT NULL)`
    }
  ]
})

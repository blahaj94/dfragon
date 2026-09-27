import { PasskeyMigrationSchema } from './passkey-migrations.js'
import { AuthLoginRequestSchema } from './auth-login-requests.js'
import { AuthRefreshTokenSchema } from './auth-refresh-tokens.js'
import { AuthSessionSchema } from './auth-sessions.js'
import { PasskeySchema } from './passkeys.js'
import { UserSchema } from './users.js'

export const databaseSchemas = [
  PasskeyMigrationSchema,
  AuthLoginRequestSchema,
  AuthRefreshTokenSchema,
  AuthSessionSchema,
  PasskeySchema,
  UserSchema
]

export const authSchemas = databaseSchemas

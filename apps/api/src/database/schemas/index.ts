import { UserSchema } from './users.js'
import { AuthSessionSchema } from './auth-sessions.js'
import { AuthRefreshTokenSchema } from './auth-refresh-tokens.js'
import { AuthLoginRequestSchema } from './auth-login-requests.js'
import { CharacterSchema } from './characters.js'
import { CharacterApiResponseSchema } from './character-api-responses.js'

export const authSchemas = [
  UserSchema,
  AuthSessionSchema,
  AuthRefreshTokenSchema,
  AuthLoginRequestSchema
]

export const databaseSchemas = [...authSchemas, CharacterSchema, CharacterApiResponseSchema]

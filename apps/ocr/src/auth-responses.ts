import { OcrError } from './errors.js'

export type AuthenticatedUser = { id: string; nickname: string }
export type SessionTokens = {
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
}
export type LoginTokens = SessionTokens & { user: AuthenticatedUser }

function responseRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new OcrError('AUTH_UNAVAILABLE')
  }
  return value as Record<string, unknown>
}

function responseText(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new OcrError('AUTH_UNAVAILABLE')
  }
  return value
}

function responseTimestamp(value: unknown): string {
  const timestamp = responseText(value)
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new OcrError('AUTH_UNAVAILABLE')
  }
  return timestamp
}

export function parseSessionTokens(value: unknown): SessionTokens {
  const body = responseRecord(value)
  return {
    accessToken: responseText(body.accessToken),
    accessTokenExpiresAt: responseTimestamp(body.accessTokenExpiresAt),
    refreshToken: responseText(body.refreshToken)
  }
}

export function parseAuthenticatedUser(value: unknown): AuthenticatedUser {
  const body = responseRecord(value)
  const user = responseRecord(body.user)
  return { id: responseText(user.id), nickname: responseText(user.nickname) }
}

export function parseLoginTokens(value: unknown): LoginTokens {
  return { ...parseSessionTokens(value), user: parseAuthenticatedUser(value) }
}

export function parseCreatedLogin(value: unknown) {
  const body = responseRecord(value)
  const browserUrl = responseText(body.browserUrl)
  if (!URL.canParse(browserUrl)) {
    throw new OcrError('AUTH_UNAVAILABLE')
  }

  return {
    requestId: responseText(body.requestId),
    browserUrl,
    expiresAt: responseTimestamp(body.expiresAt)
  }
}

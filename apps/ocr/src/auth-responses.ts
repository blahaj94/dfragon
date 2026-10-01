import { OCR_ERROR_CODE, OcrError } from './errors.js'

export type AuthenticatedUser = { id: string; nickname: string }
export type SessionTokens = {
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
}
export type LoginTokens = SessionTokens & { user: AuthenticatedUser }

function responseRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new OcrError(OCR_ERROR_CODE.AUTH_UNAVAILABLE)
  }

  return value as Record<string, unknown>
}

function responseText(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new OcrError(OCR_ERROR_CODE.AUTH_UNAVAILABLE)
  }

  return value
}

function responseTimestamp(value: unknown): string {
  const timestamp = responseText(value)
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new OcrError(OCR_ERROR_CODE.AUTH_UNAVAILABLE)
  }

  return timestamp
}

export function parseSessionTokens(value: unknown): SessionTokens {
  const body = responseRecord(value)
  const accessToken = responseText(body.accessToken)
  const accessTokenExpiresAt = responseTimestamp(body.accessTokenExpiresAt)
  const refreshToken = responseText(body.refreshToken)

  return { accessToken, accessTokenExpiresAt, refreshToken }
}

export function parseAuthenticatedUser(value: unknown): AuthenticatedUser {
  const body = responseRecord(value)
  const user = responseRecord(body.user)
  const id = responseText(user.id)
  const nickname = responseText(user.nickname)

  return { id, nickname }
}

export function parseLoginTokens(value: unknown): LoginTokens {
  const tokens = parseSessionTokens(value)
  const user = parseAuthenticatedUser(value)

  return { ...tokens, user }
}

export function parseCreatedLogin(value: unknown) {
  const body = responseRecord(value)
  const browserUrl = responseText(body.browserUrl)
  if (!URL.canParse(browserUrl)) {
    throw new OcrError(OCR_ERROR_CODE.AUTH_UNAVAILABLE)
  }
  const requestId = responseText(body.requestId)
  const expiresAt = responseTimestamp(body.expiresAt)

  return { requestId, browserUrl, expiresAt }
}

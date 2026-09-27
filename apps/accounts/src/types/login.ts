import type { LOGIN_ERRORS } from '../constants/login.js'
import type { IssueAccessJwt } from '../auth/access-jwt/types.js'
import type { DataSource } from 'typeorm'
import type { RefreshTokens } from '../auth/refresh/types.js'

export type LoginErrorDefinition = (typeof LOGIN_ERRORS)[keyof typeof LOGIN_ERRORS]
export interface LoginCreation {
  provider: 'passkey'
  clientId: 'desktop' | 'ocr'
  codeChallenge: string
  codeChallengeMethod: 'S256'
}
export interface LoginExchange {
  requestId: string
  clientId: string
  code: string
  codeVerifier: string
}
export interface PasskeyConfiguration {
  apiOrigin: string
  rpId: string
  rpName: string
  returnUrl: string
  ocrReturnUrl?: string
}
export interface LoginDependencies {
  dataSource: DataSource
  configuration: PasskeyConfiguration
  issueAccessJwt: IssueAccessJwt
}
export interface LoginTokens {
  tokenType: 'Bearer'
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
  sessionExpiresAt: string
  user: { id: string; nickname: string }
  isNewUser: boolean
}
export interface CreatedLoginRequest {
  requestId: string
  browserUrl: string
  expiresAt: string
}
export interface LoginAuthorization {
  requestId: string
  purpose: 'login' | 'manage'
  webReturnUrl?: string
  cookie: string
  view?: 'phone'
  confirmationCode?: string
}
export interface CompletedLoginCallback {
  returnUrl: string
  cookie: string
}
export interface LoginHttpService {
  create(input: unknown): Promise<CreatedLoginRequest>
  authorize(ticket: string, view?: 'phone'): Promise<LoginAuthorization>
  manage(): Promise<LoginAuthorization>
  browser(
    action: string,
    input: unknown,
    cookie: string,
    origin: string | undefined
  ): Promise<unknown>
  exchange(input: unknown): Promise<LoginTokens>
}
export interface SessionHttpService {
  refresh(rawToken: string): Promise<RefreshTokens>
  logout(rawToken: string): Promise<void>
}

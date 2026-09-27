import type { AUTH_ERRORS, AUTH_PROVIDERS } from '../constants/auth.js'

export type AuthProvider = (typeof AUTH_PROVIDERS)[keyof typeof AUTH_PROVIDERS]
export type AuthErrorDefinition = (typeof AUTH_ERRORS)[keyof typeof AUTH_ERRORS]
export type AuthErrorCode = AuthErrorDefinition['code']

/** 서버의 패스키 검증을 마친 계정만 전달한다. HTTP 입력 검증기는 아니다. */
export interface VerifiedIdentity {
  readonly userId: string
  readonly isNewUser: boolean
}

export interface IdentitySession {
  user: { id: string; nickname: string }
  session: { id: string; createdAt: Date; lastActiveAt: Date }
  refreshToken: string
  isNewUser: boolean
}

export interface IdentitySessionEntropy {
  uuid(): string
  refreshBytes(size: number): Buffer
}

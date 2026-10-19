import type {
  AuthCommandResult,
  AuthProvider,
  AuthSnapshot
} from '@dfragon/desktop-contracts/types/auth'

// renderer에 넘기는 인증 DTO는 IPC 계약 패키지가 소유한다. 기존 main 호출부가 이 모듈에서 함께 가져온다.
export type {
  AuthCommandError,
  AuthCommandResult,
  AuthNotice,
  AuthPhase,
  AuthProvider,
  AuthSnapshot
} from '@dfragon/desktop-contracts/types/auth'

export type AuthAuthorization =
  | Readonly<{
      status: 'available'
      accessToken: string
      generation: number
      accessGeneration: number
    }>
  | Readonly<{ status: 'unavailable' }>

export type RejectedAuthorization = Readonly<{
  generation: number
  accessGeneration: number
  finalRejection: boolean
}>

export type AuthTokens = Readonly<{
  tokenType: 'Bearer'
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
  sessionExpiresAt: string
}>

export type LoginExchangeResponse = AuthTokens &
  Readonly<{
    user: Readonly<{ id: string; nickname: string }>
    isNewUser: boolean
  }>

export type LoginRequestResponse = Readonly<{
  requestId: string
  browserUrl: string
  expiresAt: string
}>

export type MeResponse = Readonly<{
  user: Readonly<{ id: string; nickname: string }>
}>

export interface AuthHttp {
  createLoginRequest(
    input: Readonly<{
      provider: AuthProvider
      clientId: 'desktop'
      codeChallenge: string
      codeChallengeMethod: 'S256'
      returnUrl: string
    }>,
    signal: AbortSignal
  ): Promise<LoginRequestResponse>
  exchange(
    input: Readonly<{
      requestId: string
      clientId: 'desktop'
      code: string
      codeVerifier: string
    }>,
    signal: AbortSignal
  ): Promise<LoginExchangeResponse>
  refresh(refreshToken: string, signal: AbortSignal): Promise<AuthTokens>
  logout(refreshToken: string, signal: AbortSignal): Promise<void>
  me(accessToken: string, signal: AbortSignal): Promise<MeResponse>
}

export type ClockReading = Readonly<{
  wallMs: number
  monotonicMs: number
  discontinuous: boolean
}>

export interface AuthClock {
  read(): ClockReading
  // Production clocks reset only for a new login/refresh. Fakes may own trust inputs directly.
  startTrustPeriod?(): void
  schedule(delayMs: number, callback: () => void): () => void
}

export interface AuthEntropy {
  uuid(): string
  bytes(size: number): Uint8Array
}

export type StoreMutationOutcome = 'confirmed' | 'failed' | 'unknown'
export type CredentialTransitionKind = 'exchange' | 'refresh' | 'clear'

export type CredentialInspection =
  | Readonly<{ status: 'empty' }>
  | Readonly<{ status: 'ready'; refreshToken: string }>
  | Readonly<{ status: 'recovery-required' }>
  | Readonly<{ status: 'unavailable' }>

export interface CredentialStore {
  inspect(): Promise<CredentialInspection>
  establishTransition(kind: CredentialTransitionKind): Promise<StoreMutationOutcome>
  commitCredential(refreshToken: string): Promise<StoreMutationOutcome>
  clearCredential(): Promise<StoreMutationOutcome>
  removeTransition(): Promise<StoreMutationOutcome>
  reestablishTransition(kind: CredentialTransitionKind): Promise<StoreMutationOutcome>
}

export interface AuthBrowser {
  open(url: string): Promise<void>
}

export type LoginReturnListener = Readonly<{
  returnUrl: string
  close(): void
}>

export interface AuthLoopback {
  open(signal: AbortSignal, onReturn: (url: string) => Promise<void>): Promise<LoginReturnListener>
}

export type AuthCoordinatorDependencies = Readonly<{
  providers: readonly AuthProvider[]
  apiOrigin: string
  loopback: AuthLoopback
  activateMainWindow(): void
  browser: AuthBrowser
  clock: AuthClock
  entropy: AuthEntropy
  http: AuthHttp
  store: CredentialStore
}>

export interface AuthCoordinator {
  getSnapshot(): AuthSnapshot
  subscribe(listener: (snapshot: AuthSnapshot) => void): () => void
  start(): Promise<AuthSnapshot>
  managePasskeys(): Promise<AuthCommandResult>
  beginLogin(provider: unknown): Promise<AuthCommandResult>
  cancelLogin(attemptId: unknown): Promise<AuthCommandResult>
  handleReturnUrl(raw: unknown, onClaimed?: () => Promise<void> | void): Promise<void>
  retryAuth(): Promise<AuthCommandResult>
  captureGeneration(): number | null
  authorization(signal?: AbortSignal): Promise<AuthAuthorization>
  recoverAuthorization(
    rejected: RejectedAuthorization,
    signal?: AbortSignal
  ): Promise<AuthAuthorization>
  logout(): Promise<AuthCommandResult>
}

import type { AsyncIPCFunctions } from './ipc'

export type AuthProvider = 'passkey'

export type AuthPhase =
  | 'signedOut'
  | 'startingLogin'
  | 'waitingBrowser'
  | 'exchanging'
  | 'restoring'
  | 'restorePaused'
  | 'signedIn'
  | 'signingOut'
  | 'storageBlocked'

export type AuthNotice =
  | 'LOGIN_CANCELLED'
  | 'LOGIN_EXPIRED'
  | 'LOGIN_RETURN_INVALID'
  | 'LOGIN_RESTART_REQUIRED'
  | 'BROWSER_OPEN_FAILED'
  | 'NETWORK_UNAVAILABLE'
  | 'AUTH_SERVICE_UNAVAILABLE'
  | 'RESTORE_RETRY_REQUIRED'
  | 'REAUTH_REQUIRED'
  | 'SECURE_STORAGE_UNAVAILABLE'
  | 'TOKEN_SAVE_FAILED'
  | 'LOCAL_CLEAR_UNCONFIRMED'
  | 'LOGOUT_SERVER_UNCONFIRMED'

export type AuthCommandError =
  | 'INVALID_AUTH_COMMAND'
  | 'AUTH_NOT_ALLOWED'
  | 'AUTH_BUSY'
  | 'STALE_ATTEMPT'
  | 'AUTH_OPERATION_FAILED'

export type AuthSnapshot = Readonly<{
  runId: string
  revision: number
  phase: AuthPhase
  providers: readonly AuthProvider[]
  login: Readonly<{
    attemptId: string
    provider: AuthProvider
    expiresAt: string | null
  }> | null
  user: Readonly<{ nickname: string }> | null
  entry: 'welcome' | 'home' | null
  notice: AuthNotice | null
}>

export type AuthCommandResult =
  | Readonly<{ ok: true; snapshot: AuthSnapshot }>
  | Readonly<{
      ok: false
      error: Readonly<{ code: AuthCommandError }>
      snapshot: AuthSnapshot
    }>

/** Main이 인증 IPC를 등록한 창에만 넘기는 renderer 인자. Preload는 이 인자가 있을 때만 인증 API를 노출한다. */
export const AUTH_AVAILABLE_ARGUMENT = '--dfragon-auth-available'

export type AuthApi = Pick<
  AsyncIPCFunctions,
  'getAuthState' | 'beginLogin' | 'cancelLogin' | 'retryAuth' | 'logout' | 'managePasskeys'
> & {
  onAuthStateChanged: (listener: (snapshot: AuthSnapshot) => void) => () => void
}

export type {
  AuthSnapshot,
  AuthCommandResult,
  AuthProvider,
  AuthPhase,
  AuthNotice
} from '../../../backend/auth/types'
import type { AsyncIPCFunctions } from './ipc'
import type { AuthSnapshot } from '../../../backend/auth/types'

/** Main이 인증 IPC를 등록한 창에만 넘기는 renderer 인자. Preload는 이 인자가 있을 때만 인증 API를 노출한다. */
export const AUTH_AVAILABLE_ARGUMENT = '--dfragon-auth-available'

export type AuthApi = Pick<
  AsyncIPCFunctions,
  'getAuthState' | 'beginLogin' | 'cancelLogin' | 'retryAuth' | 'logout' | 'managePasskeys'
> & {
  onAuthStateChanged: (listener: (snapshot: AuthSnapshot) => void) => () => void
}

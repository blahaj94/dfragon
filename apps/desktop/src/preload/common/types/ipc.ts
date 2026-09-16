import type { AuthSnapshot, AuthCommandResult, AuthProvider } from './auth'
import type { CaptureSource, StableNicknameDetection } from './capture'
import type { SearchControl, SearchCommandResult, SearchObservation } from './search'

interface AsyncIPCFunctions {
  getAuthState: () => Promise<AuthSnapshot>
  beginLogin: (input: { provider: AuthProvider }) => Promise<AuthCommandResult>
  cancelLogin: (input: { attemptId: string }) => Promise<AuthCommandResult>
  retryAuth: () => Promise<AuthCommandResult>
  managePasskeys: () => Promise<AuthCommandResult>
  logout: () => Promise<AuthCommandResult>
  listCaptureSources: () => Promise<CaptureSource[]>
  selectCaptureSource: (sourceId: string) => Promise<CaptureSource | null>
  notifyStableNicknameDetected: (detection: StableNicknameDetection) => Promise<SearchCommandResult>
  notifyManualNickname: (observation: SearchObservation) => Promise<SearchCommandResult>
  controlManualSearch: (control: SearchControl) => Promise<SearchCommandResult>
  controlCharacterSearch: (control: SearchControl) => Promise<SearchCommandResult>

  // Used inside tests, so we can be a bit lenient with the type checking here
  message: (...params: unknown[]) => void
}

export type { AsyncIPCFunctions }

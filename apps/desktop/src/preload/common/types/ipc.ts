import type { AuthSnapshot, AuthCommandResult, AuthProvider } from './auth'
import type { CaptureSource, StableNicknameDetection, WindowFrameResult } from './capture'
import type {
  SearchControl,
  SearchCommandResult,
  SearchObservation,
  OcrSearchObservation
} from './search'
import type { BuildVersions } from './build-versions'
import type { CollectOcrSample, OcrCollectionResult } from './ocr-collection'
import type { DiagnosticIPCFunctions } from './diagnostics'
import type { UpdateNoticeIPCFunctions } from './update-notice'
import type {
  CharacterDetailSnapshot,
  CharacterSelectionReference,
  OpenCharacterDetailResult
} from './character-detail'

interface AsyncIPCFunctions extends DiagnosticIPCFunctions, UpdateNoticeIPCFunctions {
  collectOcrSample: (input: CollectOcrSample) => Promise<OcrCollectionResult>
  readCharacterDetail: () => Promise<CharacterDetailSnapshot>
  openCharacterDetails: (input: CharacterSelectionReference) => Promise<OpenCharacterDetailResult>
  getBuildVersions: () => Promise<BuildVersions>
  getAuthState: () => Promise<AuthSnapshot>
  beginLogin: (input: { provider: AuthProvider }) => Promise<AuthCommandResult>
  cancelLogin: (input: { attemptId: string }) => Promise<AuthCommandResult>
  retryAuth: () => Promise<AuthCommandResult>
  managePasskeys: () => Promise<AuthCommandResult>
  logout: () => Promise<AuthCommandResult>
  listCaptureSources: () => Promise<CaptureSource[]>
  selectCaptureSource: (sourceId: string) => Promise<CaptureSource | null>
  readCaptureFrame: (captureId: string) => Promise<WindowFrameResult>
  notifyStableNicknameDetected: (detection: StableNicknameDetection) => Promise<SearchCommandResult>
  notifyOcrCandidatesDetected: (observation: OcrSearchObservation) => Promise<SearchCommandResult>
  notifyManualNickname: (observation: SearchObservation) => Promise<SearchCommandResult>
  controlManualSearch: (control: SearchControl) => Promise<SearchCommandResult>
  controlCharacterSearch: (control: SearchControl) => Promise<SearchCommandResult>

  // Used inside tests, so we can be a bit lenient with the type checking here
  message: (...params: unknown[]) => void
}

export type { AsyncIPCFunctions }

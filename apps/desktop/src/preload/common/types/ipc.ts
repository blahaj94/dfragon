import type { AuthSnapshot, AuthCommandResult, AuthProvider } from './auth'
import type {
  CaptureSource,
  RaidFrameResult,
  StableNicknameDetection,
  WindowFrameResult
} from './capture'
import type {
  SearchControl,
  SearchCommandResult,
  SearchObservation,
  OcrSearchObservation
} from './search'
import type { CollectOcrSample, OcrCollectionResult } from './ocr-collection'
import type { DiagnosticIPCFunctions } from './diagnostics'
import type { UpdateNoticeIPCFunctions } from './update-notice'
import type { WindowChromeIPCFunctions } from './window-chrome'
import type {
  CharacterDetailSnapshot,
  CharacterSelectionReference,
  OpenCharacterDetailResult
} from './character-detail'

interface AsyncIPCFunctions
  extends DiagnosticIPCFunctions,
    UpdateNoticeIPCFunctions,
    WindowChromeIPCFunctions {
  collectOcrSample: (input: CollectOcrSample) => Promise<OcrCollectionResult>
  readCharacterDetail: () => Promise<CharacterDetailSnapshot>
  openCharacterDetails: (input: CharacterSelectionReference) => Promise<OpenCharacterDetailResult>
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
  controlRaidSearch: (control: SearchControl) => Promise<SearchCommandResult>
  readRaidCaptureFrame: (captureId: string) => Promise<RaidFrameResult>
  notifyRaidOcrCandidatesDetected: (
    observation: OcrSearchObservation
  ) => Promise<SearchCommandResult>
  controlCharacterSearch: (control: SearchControl) => Promise<SearchCommandResult>

  // Used inside tests, so we can be a bit lenient with the type checking here
  message: (...params: unknown[]) => void
}

export type { AsyncIPCFunctions }

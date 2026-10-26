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
import type { DiagnosticIPCFunctions } from './diagnostics'
import type { UpdateNoticeIPCFunctions } from './update-notice'
import type { WindowChromeIPCFunctions } from './window-chrome'

interface AsyncIPCFunctions
  extends DiagnosticIPCFunctions,
    UpdateNoticeIPCFunctions,
    WindowChromeIPCFunctions {
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

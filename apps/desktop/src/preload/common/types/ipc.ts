import type { CaptureSource, RaidFrameResult, WindowFrameResult } from './capture'
import type { SearchControl, SearchCommandResult, OcrSearchObservation } from './search'
import type { DiagnosticIPCFunctions } from './diagnostics'
import type { UpdateNoticeIPCFunctions } from './update-notice'
import type { WindowChromeIPCFunctions } from './window-chrome'

type SearchControlCommand = (control: SearchControl) => Promise<SearchCommandResult>
type OcrCandidatesNotification = (observation: OcrSearchObservation) => Promise<SearchCommandResult>

interface AsyncIPCFunctions
  extends DiagnosticIPCFunctions,
    UpdateNoticeIPCFunctions,
    WindowChromeIPCFunctions {
  listCaptureSources: () => Promise<CaptureSource[]>
  selectCaptureSource: (sourceId: string) => Promise<CaptureSource | null>
  readCaptureFrame: (captureId: string) => Promise<WindowFrameResult>
  notifyOcrCandidatesDetected: OcrCandidatesNotification
  controlManualSearch: SearchControlCommand
  controlRaidSearch: SearchControlCommand
  readRaidCaptureFrame: (captureId: string) => Promise<RaidFrameResult>
  notifyRaidOcrCandidatesDetected: OcrCandidatesNotification
  controlCharacterSearch: SearchControlCommand
}

export type { AsyncIPCFunctions }

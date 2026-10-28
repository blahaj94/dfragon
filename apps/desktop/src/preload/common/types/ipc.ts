import type { CaptureSource, RaidFrameResult, WindowFrameResult } from './capture'
import type { SearchControl, SearchCommandResult, OcrSearchObservation } from './search'
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
  notifyOcrCandidatesDetected: (observation: OcrSearchObservation) => Promise<SearchCommandResult>
  controlManualSearch: (control: SearchControl) => Promise<SearchCommandResult>
  controlRaidSearch: (control: SearchControl) => Promise<SearchCommandResult>
  readRaidCaptureFrame: (captureId: string) => Promise<RaidFrameResult>
  notifyRaidOcrCandidatesDetected: (
    observation: OcrSearchObservation
  ) => Promise<SearchCommandResult>
  controlCharacterSearch: (control: SearchControl) => Promise<SearchCommandResult>

  message: (...params: unknown[]) => void
}

export type { AsyncIPCFunctions }

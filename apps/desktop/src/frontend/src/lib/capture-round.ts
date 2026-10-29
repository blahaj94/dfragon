import { fromPromise } from 'xstate'
import type { CapturePhase } from '../types/capture'
import type { RaidFrameResult, WindowFrameResult } from '../../../preload/common/types/capture'
import type { FirstCandidate } from './party-recognition'

export const CAPTURE_UNSUPPORTED_STATUS = '화면 캡처는 Windows에서 사용할 수 있습니다.'
export const CAPTURE_DISCONNECTED_STATUS = '캡처 연결이 종료되었습니다. 창을 다시 선택해 주세요.'
export const CAPTURE_COMPLETE_STATUS = '인식을 마쳤습니다. 다시 인식하려면 Alt+R을 누르세요.'

export const beginCaptureSearch = fromPromise(
  async ({
    input,
    signal
  }: {
    input: { beginSearch: (signal: AbortSignal) => Promise<string | null> }
    signal: AbortSignal
  }) => {
    const captureId = await input.beginSearch(signal)
    signal.throwIfAborted()
    if (captureId === null) {
      throw new Error('Search lifetime unavailable.')
    }

    return captureId
  }
)

export function getWaitingStatus(frame: WindowFrameResult | RaidFrameResult): string {
  if (frame.kind === 'waiting' && frame.reason === 'covered') {
    return '게임 창이 가려져 있습니다. 게임 창을 앞으로 가져온 뒤 Alt+R을 누르세요.'
  }

  return '게임 화면을 읽지 못했습니다. 창이 최소화되지 않았는지 확인한 뒤 Alt+R을 누르세요.'
}

export function getRecognizeErrorStatus(error: unknown, ocrFailedStatus: string): string {
  if (error instanceof Error) {
    return error.message
  }

  return ocrFailedStatus
}

export function getObservedNickname(candidate: FirstCandidate): string {
  if (candidate.kind === 'recognized') {
    return candidate.nickname
  }

  return ''
}

export function getCapturingPhase(snapshot: {
  matches(state: { capturing: 'complete' | 'unavailable' }): boolean
}): Extract<CapturePhase, 'complete' | 'unavailable' | 'recognizing'> {
  if (snapshot.matches({ capturing: 'complete' })) {
    return 'complete'
  }

  if (snapshot.matches({ capturing: 'unavailable' })) {
    return 'unavailable'
  }

  return 'recognizing'
}

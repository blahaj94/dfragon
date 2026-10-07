import {
  captureWindowClient,
  selectWindowClient,
  WINDOW_CAPTURE_ERRORS,
  type WindowCaptureTarget
} from '../lib/win32-window-capture'
import type { WindowFrameResult } from '../../preload/common/types/capture'

export type ReadWindowFrame = () => WindowFrameResult | Promise<WindowFrameResult>

/** 선택한 창에만 결합된 읽기를 만들고 Windows 실패를 공개 캡처 상태로 정제한다. */
export function bindWindowFrame(sourceId: string): ReadWindowFrame {
  if (process.platform !== 'win32') {
    return () => ({ kind: 'unsupported' })
  }
  let target: WindowCaptureTarget
  try {
    target = selectWindowClient(sourceId)
  } catch {
    throw new Error('CAPTURE_UNAVAILABLE')
  }

  return () => {
    try {
      const { width, height, rgba } = captureWindowClient(target)
      const image = { width, height, rgba }

      return { kind: 'frame', image }
    } catch (error) {
      const covered = error instanceof Error && error.message === WINDOW_CAPTURE_ERRORS.COVERED
      const reason = covered ? 'covered' : 'unavailable'

      return { kind: 'waiting', reason }
    }
  }
}

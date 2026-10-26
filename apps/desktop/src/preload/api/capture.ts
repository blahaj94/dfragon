import { makeHandlerInvoker } from '../ipc'
import type { AsyncIPCFunctions } from '../common/types/ipc'
import { invokeSearchCommand } from './search-command'
import { parseWindowFrame } from '../common/capture-frame'

const invokeReadCaptureFrame = makeHandlerInvoker('readCaptureFrame')
export const readCaptureFrame: AsyncIPCFunctions['readCaptureFrame'] = async (captureId) => {
  const value: unknown = await invokeReadCaptureFrame(captureId)

  return parseWindowFrame(value)
}

export const listCaptureSources = makeHandlerInvoker('listCaptureSources')
export const selectCaptureSource = makeHandlerInvoker('selectCaptureSource')
export const notifyStableNicknameDetected: AsyncIPCFunctions['notifyStableNicknameDetected'] = (
  observation
) => invokeSearchCommand('notifyStableNicknameDetected', observation)

export const notifyOcrCandidatesDetected: AsyncIPCFunctions['notifyOcrCandidatesDetected'] = (
  observation
) => invokeSearchCommand('notifyOcrCandidatesDetected', observation)

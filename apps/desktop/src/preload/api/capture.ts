import { makeHandlerInvoker } from '../ipc'
import type { AsyncIPCFunctions } from '../common/types/ipc'
import { invokeSearchCommand } from './search-command'

const invokeOpenCharacterDetails = makeHandlerInvoker('openCharacterDetails')
export const openCharacterDetails: AsyncIPCFunctions['openCharacterDetails'] = async (input) => {
  try {
    const value: unknown = await invokeOpenCharacterDetails(input)
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Reflect.ownKeys(value).length !== 1 ||
      !('ok' in value) ||
      typeof value.ok !== 'boolean'
    ) {
      throw new Error('CHARACTER_DETAIL_UNAVAILABLE')
    }

    return { ok: value.ok }
  } catch {
    throw new Error('CHARACTER_DETAIL_UNAVAILABLE')
  }
}

export const listCaptureSources = makeHandlerInvoker('listCaptureSources')
export const selectCaptureSource = makeHandlerInvoker('selectCaptureSource')
export const notifyStableNicknameDetected: AsyncIPCFunctions['notifyStableNicknameDetected'] = (
  observation
) => invokeSearchCommand('notifyStableNicknameDetected', observation)

export const notifyOcrCandidatesDetected: AsyncIPCFunctions['notifyOcrCandidatesDetected'] = (
  observation
) => invokeSearchCommand('notifyOcrCandidatesDetected', observation)

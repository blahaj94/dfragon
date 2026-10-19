import { ipcRenderer } from 'electron'
import { SEARCH_SLOT_COUNTS, type SearchApi } from '@dfragon/desktop-contracts/types/search'
import type { AsyncIPCFunctions } from '@dfragon/desktop-contracts/types/ipc'
import { parseSearchSnapshot } from '@dfragon/desktop-contracts/search/snapshot'
import { parseRaidFrame } from '@dfragon/desktop-contracts/capture-frame'
import { makeHandlerInvoker } from '../ipc'
import { invokeSearchCommand } from './search-command'

export const controlCharacterSearch: SearchApi['controlCharacterSearch'] = (control) =>
  invokeSearchCommand('controlRaidSearch', control)

/** 공대 캡처 회차의 OCR 이름을 공대 수명의 자리에 알린다. 서버는 main의 이름 식별이 고른다. */
export const notifyOcrCandidatesDetected: AsyncIPCFunctions['notifyRaidOcrCandidatesDetected'] = (
  observation
) => invokeSearchCommand('notifyRaidOcrCandidatesDetected', observation)

const invokeReadCaptureFrame = makeHandlerInvoker('readRaidCaptureFrame')
/** 공대 캡처 회차의 프레임 한 장에서 main이 잘라 낸 12행 닉네임 크롭을 받는다. */
export const readCaptureFrame: AsyncIPCFunctions['readRaidCaptureFrame'] = async (captureId) => {
  const value: unknown = await invokeReadCaptureFrame(captureId)

  return parseRaidFrame(value)
}

export const onCharacterSearchChanged: SearchApi['onCharacterSearchChanged'] = (listener) => {
  const wrapper = (_event: Electron.IpcRendererEvent, value: unknown): void => {
    const snapshot = parseSearchSnapshot(value, SEARCH_SLOT_COUNTS.raid)
    if (snapshot != null) {
      listener(snapshot)
    }
  }
  ipcRenderer.on('raidSearchChanged', wrapper)

  return () => {
    ipcRenderer.removeListener('raidSearchChanged', wrapper)
  }
}

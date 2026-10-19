import { ipcRenderer } from 'electron'
import type { AsyncIPCFunctions } from '@dfragon/desktop-contracts/types/ipc'
import { parseBuildVersions } from '@dfragon/desktop-contracts/build-versions'

export const getBuildVersions: AsyncIPCFunctions['getBuildVersions'] = async () => {
  const value: unknown = await ipcRenderer.invoke('getBuildVersions')
  const snapshot = parseBuildVersions(value)
  if (snapshot == null) {
    throw new Error('버전 정보의 응답을 확인하지 못했습니다.')
  }

  return snapshot
}

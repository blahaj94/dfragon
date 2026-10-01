import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { addHandler } from '../ipc'
import { createServerVersionReader } from './http'
import type { AsyncIPCFunctions } from '../../preload/common/types/ipc'
import type { BuildVersions } from '../../preload/common/types/build-versions'

export function registerVersionsWindow({
  window,
  documentUrl,
  desktop,
  apiOrigin,
  accountsOrigin
}: {
  window: BrowserWindow
  documentUrl: string
  desktop: () => BuildVersions['desktop']
  apiOrigin: string | null
  accountsOrigin: string | null
}): () => void {
  let disposed = false
  let documentRevision = 0
  const readServers = createServerVersionReader({ apiOrigin, accountsOrigin })
  let pendingServers: Promise<BuildVersions['servers']> | null = null

  function requireSender(event: IpcMainInvokeEvent, revision = documentRevision): void {
    const alive = !disposed && !window.isDestroyed() && !window.webContents.isDestroyed()
    const frame = alive ? window.webContents.mainFrame : null
    const mainFrame = frame != null && event.senderFrame === frame
    const attached = mainFrame && !frame.isDestroyed() && !frame.detached
    if (
      !attached ||
      event.sender !== window.webContents ||
      frame.url !== documentUrl ||
      revision !== documentRevision
    ) {
      throw new Error('VERSION_NOT_ALLOWED')
    }
  }

  function navigated(
    _event: unknown,
    _url: string,
    isInPlace: boolean,
    isMainFrame: boolean
  ): void {
    if (isMainFrame && !isInPlace) {
      documentRevision += 1
    }
  }

  const handler = async (
    event: IpcMainInvokeEvent,
    ...args: Parameters<AsyncIPCFunctions['getBuildVersions']>
  ): Promise<BuildVersions> => {
    requireSender(event)
    if (args.length !== 0) {
      throw new Error('INVALID_VERSION_COMMAND')
    }
    const revision = documentRevision
    const info = desktop()
    pendingServers ??= readServers().finally(() => {
      pendingServers = null
    })
    const servers = await pendingServers
    requireSender(event, revision)

    return { desktop: info, servers }
  }

  function dispose(): void {
    if (disposed) {

      return
    }
    disposed = true
    ipcMain.removeHandler('getBuildVersions')
    window.removeListener('closed', dispose)
    window.webContents.removeListener('destroyed', dispose)
    window.webContents.removeListener('did-start-navigation', navigated)
  }

  addHandler('getBuildVersions', handler)
  try {
    window.on('closed', dispose)
    window.webContents.on('destroyed', dispose)
    window.webContents.on('did-start-navigation', navigated)
  } catch (error) {
    dispose()
    throw error
  }

  return dispose
}

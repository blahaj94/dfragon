import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { AsyncIPCFunctions } from '@dfragon/desktop-contracts/types/ipc'

function addHandler<ChannelName extends keyof AsyncIPCFunctions>(
  channel: ChannelName,
  handler: (
    e: IpcMainInvokeEvent,
    ...args: Parameters<AsyncIPCFunctions[ChannelName]>
  ) =>
    | ReturnType<AsyncIPCFunctions[ChannelName]>
    | Awaited<ReturnType<AsyncIPCFunctions[ChannelName]>>
): void {
  ipcMain.handle(channel, handler)
}

export { addHandler }

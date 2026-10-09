import { ipcMain, shell, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { isReleaseTag } from '../../preload/common/update-notice'
import {
  UPDATE_NOTICE_CHANNELS,
  type UpdateNoticeIPCFunctions
} from '../../preload/common/types/update-notice'
import type { UpdateNotices } from './notices'
import { releasePageUrl } from './release-feed'

/** 신뢰한 메인 화면에 새 버전 알림의 조회, 닫기, Release 열기를 연결한다. */
export function registerUpdateNoticeWindow({
  window,
  documentUrl,
  notices,
  onFailure
}: {
  window: BrowserWindow
  documentUrl: string
  notices: UpdateNotices
  onFailure: (code: 'UPDATE_RELEASE_OPEN_FAILED') => void
}): () => void {
  let disposed = false
  const contents = window.webContents
  const registeredChannels: string[] = []

  function hasTrustedDocument(): boolean {
    if (disposed || window.isDestroyed() || contents.isDestroyed()) {
      return false
    }
    const frame = contents.mainFrame

    return !frame.isDestroyed() && !frame.detached && frame.url === documentUrl
  }

  function requireSender(event: IpcMainInvokeEvent): void {
    if (
      !hasTrustedDocument() ||
      event.sender !== contents ||
      event.senderFrame !== contents.mainFrame
    ) {
      throw new Error('UPDATE_NOTICE_NOT_ALLOWED')
    }
  }

  function requireTag(args: readonly unknown[]): string {
    const [tag] = args
    if (args.length !== 1 || !isReleaseTag(tag)) {
      throw new Error('INVALID_UPDATE_NOTICE_COMMAND')
    }

    return tag
  }

  const read = async (
    event: IpcMainInvokeEvent,
    ...args: Parameters<UpdateNoticeIPCFunctions['getUpdateNotice']>
  ): ReturnType<UpdateNoticeIPCFunctions['getUpdateNotice']> => {
    requireSender(event)
    if (args.length !== 0) {
      throw new Error('INVALID_UPDATE_NOTICE_COMMAND')
    }

    return notices.snapshot()
  }

  const dismiss = async (
    event: IpcMainInvokeEvent,
    ...args: Parameters<UpdateNoticeIPCFunctions['dismissUpdateNotice']>
  ): ReturnType<UpdateNoticeIPCFunctions['dismissUpdateNotice']> => {
    requireSender(event)

    return notices.dismiss(requireTag(args))
  }

  const open = async (
    event: IpcMainInvokeEvent,
    ...args: Parameters<UpdateNoticeIPCFunctions['openUpdateRelease']>
  ): ReturnType<UpdateNoticeIPCFunctions['openUpdateRelease']> => {
    requireSender(event)
    const tag = requireTag(args)
    // 화면이 늦게 받은 이전 알림이나 이미 닫은 알림의 Release는 열지 않는다.
    const url = notices.snapshot().notice?.tag === tag ? releasePageUrl(tag) : null
    if (url == null) {
      return
    }
    try {
      await shell.openExternal(url)
    } catch {
      onFailure('UPDATE_RELEASE_OPEN_FAILED')
      throw new Error('UPDATE_RELEASE_OPEN_FAILED')
    }
  }

  const unsubscribe = notices.subscribe((snapshot) => {
    if (hasTrustedDocument()) {
      contents.send(UPDATE_NOTICE_CHANNELS.changed, snapshot)
    }
  })

  function dispose(): void {
    if (disposed) {
      return
    }
    disposed = true
    unsubscribe()
    for (const channel of registeredChannels) {
      ipcMain.removeHandler(channel)
    }
    contents.removeListener('destroyed', dispose)
    window.removeListener('closed', dispose)
  }

  try {
    for (const [channel, handler] of [
      [UPDATE_NOTICE_CHANNELS.read, read],
      [UPDATE_NOTICE_CHANNELS.dismiss, dismiss],
      [UPDATE_NOTICE_CHANNELS.open, open]
    ] as const) {
      ipcMain.handle(channel, handler)
      registeredChannels.push(channel)
    }
    contents.on('destroyed', dispose)
    window.on('closed', dispose)
  } catch (error) {
    dispose()
    throw error
  }

  return dispose
}

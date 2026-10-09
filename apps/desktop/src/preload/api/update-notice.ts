import { ipcRenderer } from 'electron'
import { isReleaseTag, parseUpdateNoticeSnapshot } from '../common/update-notice'
import {
  UPDATE_NOTICE_CHANNELS,
  type UpdateNoticeApi,
  type UpdateNoticeSnapshot
} from '../common/types/update-notice'

function requireSnapshot(value: unknown): UpdateNoticeSnapshot {
  const snapshot = parseUpdateNoticeSnapshot(value)
  if (snapshot == null) {
    throw new Error('INVALID_UPDATE_NOTICE_RESPONSE')
  }

  return snapshot
}

function requireTag(tag: unknown): string {
  if (!isReleaseTag(tag)) {
    throw new Error('INVALID_UPDATE_NOTICE_COMMAND')
  }

  return tag
}

export const getUpdateNotice: UpdateNoticeApi['getUpdateNotice'] = async () => {
  return requireSnapshot(await ipcRenderer.invoke(UPDATE_NOTICE_CHANNELS.read))
}

export const dismissUpdateNotice: UpdateNoticeApi['dismissUpdateNotice'] = async (tag) => {
  const command = requireTag(tag)

  return requireSnapshot(await ipcRenderer.invoke(UPDATE_NOTICE_CHANNELS.dismiss, command))
}

export const openUpdateRelease: UpdateNoticeApi['openUpdateRelease'] = async (tag) => {
  const command = requireTag(tag)
  await ipcRenderer.invoke(UPDATE_NOTICE_CHANNELS.open, command)
}

export const onUpdateNoticeChanged: UpdateNoticeApi['onUpdateNoticeChanged'] = (listener) => {
  const handle = (_event: unknown, value: unknown): void => {
    const snapshot = parseUpdateNoticeSnapshot(value)
    if (snapshot != null) {
      listener(snapshot)
    }
  }
  ipcRenderer.on(UPDATE_NOTICE_CHANNELS.changed, handle)

  return () => {
    ipcRenderer.removeListener(UPDATE_NOTICE_CHANNELS.changed, handle)
  }
}

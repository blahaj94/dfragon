export const UPDATE_NOTICE_CHANNELS = {
  read: 'getUpdateNotice',
  dismiss: 'dismissUpdateNotice',
  open: 'openUpdateRelease',
  changed: 'updateNoticeChanged'
} as const

export type UpdateNotice = Readonly<{
  tag: string
}>

export type UpdateNoticeSnapshot = Readonly<{
  revision: number
  notice: UpdateNotice | null
}>

export interface UpdateNoticeIPCFunctions {
  getUpdateNotice: () => Promise<UpdateNoticeSnapshot>
  dismissUpdateNotice: (tag: string) => Promise<UpdateNoticeSnapshot>
  openUpdateRelease: (tag: string) => Promise<void>
}

export interface UpdateNoticeApi extends UpdateNoticeIPCFunctions {
  onUpdateNoticeChanged: (listener: (snapshot: UpdateNoticeSnapshot) => void) => () => void
}

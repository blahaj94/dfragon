export const UPDATE_NOTICE_CHANNELS = {
  read: 'getUpdateNotice',
  dismiss: 'dismissUpdateNotice',
  open: 'openUpdateRelease',
  changed: 'updateNoticeChanged'
} as const

/** 현재 버전보다 높은 Release 하나. */
export type UpdateNotice = Readonly<{
  /** `v<semver>` 형식의 정식, alpha, beta Release tag. */
  tag: string
  /** 현재 빌드는 OCR 자료를 수집하지만 알린 버전은 수집하지 않는다. */
  endsOcrCollection: boolean
}>

/** main이 소유한 알림 상태. revision이 클수록 나중 상태다. */
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

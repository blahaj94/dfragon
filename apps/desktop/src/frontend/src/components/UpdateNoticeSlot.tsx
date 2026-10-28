import { useUpdateNotice } from '../hooks/useUpdateNotice'
import { UpdateNotice } from './UpdateNotice'

/**
 * 상단 바의 새 버전 알림 자리. main이 확인한 새 버전 알림을 구독하고, 알릴 새 버전이 있을 때만 칩을 그린다.
 */
export function UpdateNoticeSlot(): React.JSX.Element | null {
  const updateNotice = useUpdateNotice()

  if (updateNotice.notice == null) {
    return null
  }

  return (
    <UpdateNotice
      tag={updateNotice.notice.tag}
      onOpenRelease={updateNotice.openRelease}
      onDismiss={updateNotice.dismiss}
    />
  )
}

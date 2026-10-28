import { useUpdateNotice } from '../hooks/useUpdateNotice'
import { UpdateNotice } from './UpdateNotice'

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

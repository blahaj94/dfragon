import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  UpdateNotice,
  UpdateNoticeApi,
  UpdateNoticeSnapshot
} from '../../../preload/common/types/update-notice'

function readBridge(): UpdateNoticeApi | null {
  const candidate = typeof window === 'undefined' ? undefined : window.updateNotice

  if (candidate != null && typeof candidate.getUpdateNotice === 'function') {
    return candidate
  }

  return null
}

export function useUpdateNotice(): {
  notice: UpdateNotice | null
  openRelease: () => void
  dismiss: () => void
} {
  const [notice, setNotice] = useState<UpdateNotice | null>(null)
  const appliedRevision = useRef(-1)

  // 조회 응답과 변경 알림이 어떤 순서로 와도 나중 상태만 반영한다.
  const apply = useCallback((snapshot: UpdateNoticeSnapshot) => {
    if (snapshot.revision <= appliedRevision.current) {
      return
    }
    appliedRevision.current = snapshot.revision
    setNotice(snapshot.notice)
  }, [])

  useEffect(() => {
    const bridge = readBridge()
    if (bridge == null) {
      return
    }
    let active = true
    const receive = (snapshot: UpdateNoticeSnapshot): void => {
      if (active) {
        apply(snapshot)
      }
    }
    const unsubscribe = bridge.onUpdateNoticeChanged(receive)
    void bridge
      .getUpdateNotice()
      .then(receive)
      .catch(() => undefined)

    return () => {
      active = false
      unsubscribe()
    }
  }, [apply])

  const openRelease = useCallback(() => {
    const bridge = readBridge()
    if (bridge == null || notice == null) {
      return
    }
    void bridge.openUpdateRelease(notice.tag).catch(() => undefined)
  }, [notice])

  const dismiss = useCallback(() => {
    const bridge = readBridge()
    if (bridge == null || notice == null) {
      return
    }
    void bridge
      .dismissUpdateNotice(notice.tag)
      .then(apply)
      .catch(() => undefined)
  }, [apply, notice])

  return { notice, openRelease, dismiss }
}

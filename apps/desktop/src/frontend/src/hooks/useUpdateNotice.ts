import { useCallback, useEffect, useState } from 'react'
import type {
  UpdateNotice,
  UpdateNoticeApi,
  UpdateNoticeSnapshot
} from '../../../preload/common/types/update-notice'

const EMPTY_SNAPSHOT: UpdateNoticeSnapshot = { revision: -1, notice: null }

function readBridge(): UpdateNoticeApi | null {
  const candidate = typeof window === 'undefined' ? undefined : window.updateNotice

  if (candidate != null && typeof candidate.getUpdateNotice === 'function') {
    return candidate
  }

  return null
}

// 조회 응답과 변경 알림이 어떤 순서로 와도 나중 상태만 반영한다.
function pickLatest(
  current: UpdateNoticeSnapshot,
  next: UpdateNoticeSnapshot
): UpdateNoticeSnapshot {
  if (next.revision <= current.revision) {
    return current
  }

  return next
}

export function useUpdateNotice(): {
  notice: UpdateNotice | null
  openRelease: () => void
  dismiss: () => void
} {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT)
  const { notice } = snapshot

  useEffect(() => {
    const bridge = readBridge()
    if (bridge == null) {
      return
    }
    let active = true
    const receive = (next: UpdateNoticeSnapshot): void => {
      if (active) {
        setSnapshot((current) => pickLatest(current, next))
      }
    }
    const unsubscribe = bridge.onUpdateNoticeChanged(receive)
    bridge
      .getUpdateNotice()
      .then(receive)
      .catch(() => undefined)

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const openRelease = useCallback(() => {
    const bridge = readBridge()
    if (bridge == null || notice == null) {
      return
    }
    bridge.openUpdateRelease(notice.tag).catch(() => undefined)
  }, [notice])

  const dismiss = useCallback(() => {
    const bridge = readBridge()
    if (bridge == null || notice == null) {
      return
    }
    bridge
      .dismissUpdateNotice(notice.tag)
      .then((next) => setSnapshot((current) => pickLatest(current, next)))
      .catch(() => undefined)
  }, [notice])

  return { notice, openRelease, dismiss }
}

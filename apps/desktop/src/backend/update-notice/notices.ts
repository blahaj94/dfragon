import type { UpdateNotice, UpdateNoticeSnapshot } from '../../preload/common/types/update-notice'
import { readReleaseFeedTags, selectUpdateNotice } from './release-feed'

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

export type UpdateNotices = Readonly<{
  /** 바로 한 번 확인하고 이후 주기마다 다시 확인한다. */
  start: () => void
  snapshot: () => UpdateNoticeSnapshot
  subscribe: (listener: (snapshot: UpdateNoticeSnapshot) => void) => () => void
  /** 지금 알리는 버전이면 앱을 다시 시작할 때까지 다시 알리지 않는다. */
  dismiss: (tag: string) => UpdateNoticeSnapshot
  dispose: () => void
}>

/**
 * 새 버전 확인의 주기, 취소, 늦은 결과 차단과 알림 상태를 소유한다.
 * Release 판정은 release-feed의 순수 함수가 맡는다.
 */
export function createUpdateNotices({
  currentVersion,
  readFeed,
  onFailure
}: {
  currentVersion: string
  readFeed: (signal: AbortSignal) => Promise<string>
  onFailure: (code: 'UPDATE_CHECK_FAILED') => void
}): UpdateNotices {
  const listeners = new Set<(snapshot: UpdateNoticeSnapshot) => void>()
  const dismissed = new Set<string>()
  let latest: UpdateNotice | null = null
  let revision = 0
  let timer: ReturnType<typeof setInterval> | null = null
  let running: AbortController | null = null
  let disposed = false

  function snapshot(): UpdateNoticeSnapshot {
    const isVisible = latest != null && !dismissed.has(latest.tag)
    const notice = isVisible ? latest : null

    return { revision, notice }
  }

  function publish(): void {
    revision += 1
    const current = snapshot()
    for (const listener of listeners) {
      try {
        listener(current)
      } catch {
        // 화면 전달 실패가 다음 확인을 막지 않는다.
      }
    }
  }

  async function check(): Promise<void> {
    if (disposed || running != null) {
      return
    }
    const controller = new AbortController()
    running = controller
    try {
      const tags = readReleaseFeedTags(await readFeed(controller.signal))
      if (controller.signal.aborted) {
        return
      }

      if (tags == null) {
        onFailure('UPDATE_CHECK_FAILED')

        return
      }
      const next = selectUpdateNotice(currentVersion, tags)
      if (next?.tag !== latest?.tag) {
        latest = next
        publish()
      }
    } catch {
      // 확인 실패는 이전 알림을 유지하고 다음 주기에 다시 시도한다.
      if (!controller.signal.aborted) {
        onFailure('UPDATE_CHECK_FAILED')
      }
    } finally {
      if (running === controller) {
        running = null
      }
    }
  }

  function start(): void {
    if (disposed || timer != null) {
      return
    }
    timer = setInterval(() => void check(), UPDATE_CHECK_INTERVAL_MS)
    void check()
  }

  function subscribe(listener: (snapshot: UpdateNoticeSnapshot) => void): () => void {
    if (disposed) {
      return () => undefined
    }
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  }

  function dismiss(tag: string): UpdateNoticeSnapshot {
    if (latest?.tag === tag && !dismissed.has(tag)) {
      dismissed.add(tag)
      publish()
    }

    return snapshot()
  }

  function dispose(): void {
    if (disposed) {
      return
    }
    disposed = true
    if (timer != null) {
      clearInterval(timer)
    }
    running?.abort()
    listeners.clear()
  }

  return { start, snapshot, subscribe, dismiss, dispose }
}

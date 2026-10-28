import { useEffect, useState } from 'react'
import { CAPTURE_SOURCE_RETRY_INTERVAL_MS } from '../constants/capture'
import { isDnfCaptureSource } from '../lib/capture-presentation'

type CaptureSource = { id: string; name: string }

export function useCaptureSources(): {
  sources: CaptureSource[]
  sourcesLoading: boolean
  sourcesFailed: boolean
  retryStartedAt: number
  refreshSources: () => void
} {
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [sourcesFailed, setSourcesFailed] = useState(false)
  const [sources, setSources] = useState<CaptureSource[]>([])
  // 목록을 늦게 열어도 재조회 진행 막대가 실제 남은 시간과 맞도록 새 목록이 온 시각을 기억한다. 벽시계가
  // 바뀌어도 실제 타이머와 어긋나지 않도록 단조 시계로 잰다.
  const [retryStartedAt, setRetryStartedAt] = useState(() => performance.now())
  const [sourceListVersion, setSourceListVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    async function loadSources(): Promise<void> {
      let foundGame = false
      setSourcesLoading(true)
      try {
        const nextSources = await window.api.listCaptureSources()
        if (cancelled) {
          return
        }
        setSources(nextSources)
        setRetryStartedAt(performance.now())
        setSourcesFailed(false)
        foundGame = nextSources.filter(isDnfCaptureSource).length === 1
      } catch {
        if (cancelled) {
          return
        }
        setSourcesFailed(true)
      }
      setSourcesLoading(false)
      // 완료된 조회 뒤에만 예약해 느린 IPC와 다음 자동 조회가 겹치지 않게 한다.
      if (!foundGame) {
        retryTimer = setTimeout(() => loadSources(), CAPTURE_SOURCE_RETRY_INTERVAL_MS)
      }
    }

    loadSources()

    return () => {
      cancelled = true
      clearTimeout(retryTimer)
    }
  }, [sourceListVersion])

  function refreshSources(): void {
    setSourcesLoading(true)
    setSourcesFailed(false)
    setSourceListVersion((version) => version + 1)
  }

  return { sources, sourcesLoading, sourcesFailed, retryStartedAt, refreshSources }
}

import { useEffect, useState } from 'react'
import { CAPTURE_SOURCE_RETRY_INTERVAL_MS } from '../constants/capture'
import { isDnfCaptureSource } from '../lib/capture-presentation'

type CaptureSource = { id: string; name: string }

export function useCaptureSources(): {
  sources: CaptureSource[]
  sourcesLoading: boolean
  sourcesFailed: boolean
  refreshSources: () => void
} {
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [sourcesFailed, setSourcesFailed] = useState(false)
  const [sources, setSources] = useState<CaptureSource[]>([])
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
        retryTimer = setTimeout(() => void loadSources(), CAPTURE_SOURCE_RETRY_INTERVAL_MS)
      }
    }

    void loadSources()

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

  return { sources, sourcesLoading, sourcesFailed, refreshSources }
}

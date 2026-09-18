import { useEffect, useState } from 'react'

type CaptureSource = { id: string; name: string }

export function useCaptureSources(setStatus: (status: string) => void): {
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
    void window.api
      .listCaptureSources()
      .then((nextSources) => {
        if (!cancelled) {
          setSources(nextSources)
          setSourcesLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSourcesLoading(false)
          setSourcesFailed(true)
          setStatus(
            '창 목록을 불러오지 못했습니다. 게임을 실행한 뒤 ‘창 목록 새로고침’을 눌러 주세요.'
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [setStatus, sourceListVersion])

  function refreshSources(): void {
    setSourcesLoading(true)
    setSourcesFailed(false)
    setSourceListVersion((version) => version + 1)
  }

  return { sources, sourcesLoading, sourcesFailed, refreshSources }
}

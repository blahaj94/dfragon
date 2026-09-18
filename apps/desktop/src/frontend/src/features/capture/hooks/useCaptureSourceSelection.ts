import { useEffect, useRef, useState } from 'react'

type CaptureSource = { id: string; name: string }

export function useCaptureSourceSelection(setStatus: (status: string) => void): {
  sources: CaptureSource[]
  selectedSourceId: string
  sourceRegistered: boolean
  isSelectedSourceRegistered: () => boolean
  refreshSources: () => void
  selectSource: (sourceId: string) => void
} {
  const selectionGenerationRef = useRef(0)
  const selectedSourceIdRef = useRef('')
  const registeredSourceIdRef = useRef<string | null>(null)
  const [sources, setSources] = useState<CaptureSource[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState('')
  const [sourceRegistered, setSourceRegistered] = useState(false)
  const [sourceListVersion, setSourceListVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    void window.api
      .listCaptureSources()
      .then((nextSources) => {
        if (!cancelled) {
          setSources(nextSources)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus(
            '창 목록을 불러오지 못했습니다. 게임을 실행한 뒤 ‘창 목록 새로고침’을 눌러 주세요.'
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [setStatus, sourceListVersion])

  useEffect(() => {
    return () => {
      selectionGenerationRef.current += 1
      void window.api.selectCaptureSource('').catch(() => undefined)
    }
  }, [])

  function refreshSources(): void {
    setSourceListVersion((version) => version + 1)
  }

  function selectSource(sourceId: string): void {
    const selectionGeneration = ++selectionGenerationRef.current
    selectedSourceIdRef.current = sourceId
    registeredSourceIdRef.current = null
    setSelectedSourceId(sourceId)
    setSourceRegistered(false)
    setStatus(
      sourceId.length > 0 ? '게임 창 선택을 확인하고 있습니다.' : '캡처할 게임 창을 선택해 주세요.'
    )
    void window.api
      .selectCaptureSource(sourceId)
      .then(() => {
        const hasSourceId = sourceId.length > 0
        if (!hasSourceId) {
          return
        }
        const hasCurrentGeneration = selectionGeneration === selectionGenerationRef.current
        if (!hasCurrentGeneration) {
          return
        }

        const hasCurrentSelection = selectedSourceIdRef.current === sourceId
        if (hasCurrentSelection) {
          registeredSourceIdRef.current = sourceId
          setSourceRegistered(true)
          setStatus('게임 창을 선택했습니다. 캡처 시작을 눌러 주세요.')
        }
      })
      .catch(() => {
        const hasCurrentGeneration = selectionGeneration === selectionGenerationRef.current
        if (hasCurrentGeneration) {
          setStatus('게임 창을 선택하지 못했습니다. 창을 다시 선택해 주세요.')
        }
      })
  }

  function isSelectedSourceRegistered(): boolean {
    const isRegistered = selectedSourceIdRef.current === registeredSourceIdRef.current

    return isRegistered
  }

  return {
    sources,
    selectedSourceId,
    sourceRegistered,
    isSelectedSourceRegistered,
    refreshSources,
    selectSource
  }
}

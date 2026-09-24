import { useEffect, useRef, useState } from 'react'
import type { DeveloperSample } from '../../../preload/common/types/developer'

export function useDeveloperSamples(): {
  samples: DeveloperSample[]
  loading: boolean
  saving: boolean
  error: string
  refresh: () => Promise<void>
  addSample: (pngDataUrl: string) => Promise<DeveloperSample | null>
  saveLabel: (id: string, text: string | null) => Promise<DeveloperSample | null>
} {
  const alive = useRef(true)
  const operation = useRef(false)
  const [samples, setSamples] = useState<DeveloperSample[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    alive.current = true
    void refresh()
    return () => {
      alive.current = false
    }
  }, [])

  async function refresh(): Promise<void> {
    setLoading(true)
    setError('')
    try {
      const rows = await window.developer.listSamples()
      if (alive.current) {
        setSamples(rows)
      }
    } catch {
      if (alive.current) {
        setError('테스트 이미지를 불러오지 못했습니다. 다시 불러와 주세요.')
      }
    } finally {
      if (alive.current) {
        setLoading(false)
      }
    }
  }

  async function save(action: () => Promise<DeveloperSample>): Promise<DeveloperSample | null> {
    if (operation.current) {
      return null
    }
    operation.current = true
    setSaving(true)
    setError('')
    try {
      const sample = await action()
      if (!alive.current) {
        return null
      }
      setSamples((previous) =>
        previous.some((row) => row.id === sample.id)
          ? previous.map((row) => (row.id === sample.id ? sample : row))
          : [...previous, sample]
      )
      return sample
    } catch {
      if (alive.current) {
        setError('저장하지 못했습니다. 입력은 유지됩니다. 다시 시도해 주세요.')
      }
      return null
    } finally {
      operation.current = false
      if (alive.current) {
        setSaving(false)
      }
    }
  }
  return {
    samples,
    loading,
    saving,
    error,
    refresh,
    addSample: (pngDataUrl: string) => save(() => window.developer.addSample(pngDataUrl)),
    saveLabel: (id: string, text: string | null) => save(() => window.developer.saveLabel(id, text))
  }
}

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { assignedSplits, type AssignedSplit } from '../../src/model.js'
import type { SplitOptions, SplitPreview, SplitStatistics } from '../../src/split-plan.js'
import { errorMessage, requestOcr } from '../client.js'
import { invalidateDataset, ocrKeys } from '../query.js'

export function useSplitPlanner() {
  const client = useQueryClient()
  const [ratios, setRatios] = useState({ train: '', val: '', test: '' })
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [preview, setPreview] = useState<SplitPreview | null>(null)
  const [applied, setApplied] = useState(false)
  const stats = useQuery({
    queryKey: ocrKeys.splitStats,
    queryFn: ({ signal }) =>
      requestOcr<SplitStatistics & { initialized: boolean }>(
        '/api/splits/statistics',
        'GET',
        undefined,
        signal
      )
  })
  const generate = useMutation({
    mutationFn: (options: SplitOptions) =>
      requestOcr<SplitPreview>('/api/splits/preview', 'POST', options),
    onSuccess: (result) => {
      setPreview(result)
      setApplied(false)
    }
  })
  const apply = useMutation({
    mutationFn: (value: SplitPreview) =>
      requestOcr('/api/splits/apply', 'POST', { ...value.options, fingerprint: value.fingerprint }),
    onSuccess: async () => {
      setPreview(null)
      setApplied(true)
      await invalidateDataset(client)
    },
    onError: () => setPreview(null)
  })

  function changeRatio(split: AssignedSplit, value: string) {
    setRatios((current) => ({ ...current, [split]: value }))
    setPreview(null)
  }
  function changeReplacement(value: boolean) {
    setReplaceExisting(value)
    setPreview(null)
  }
  function previewSplit() {
    setPreview(null)
    generate.mutate({
      ratios: { train: Number(ratios.train), val: Number(ratios.val), test: Number(ratios.test) },
      replaceExisting
    })
  }
  const valid =
    assignedSplits.every(
      (split) => ratios[split] !== '' && Number(ratios[split]) >= 0 && Number(ratios[split]) <= 100
    ) &&
    Math.abs(assignedSplits.reduce((sum, split) => sum + Number(ratios[split]), 0) - 100) < 1e-6
  const error = stats.error ?? generate.error ?? apply.error
  const statistics = stats.data
  const busy = generate.isPending || apply.isPending
  const canPreview = valid && (stats.data?.total.images ?? 0) > 0
  const message = error === null ? null : errorMessage(error)

  return {
    stats: statistics,
    ratios,
    replaceExisting,
    preview,
    applied,
    busy,
    canPreview,
    error: message,
    changeRatio,
    changeReplacement,
    previewSplit,
    applySplit: apply.mutate
  }
}

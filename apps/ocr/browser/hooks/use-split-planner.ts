import { useRef, useState } from 'react'
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
  const [revision, setRevision] = useState(0)
  const command = useRef<{ pending: boolean; revision: number; preview: SplitPreview | null }>({
    pending: false,
    revision: 0,
    preview: null
  })
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
      command.current.preview = result
      setPreview(result)
      setApplied(false)
    },
    onSettled: () => {
      command.current.pending = false
    }
  })
  const apply = useMutation({
    mutationFn: (value: SplitPreview) =>
      requestOcr('/api/splits/apply', 'POST', { ...value.options, fingerprint: value.fingerprint }),
    onSuccess: async () => {
      command.current.preview = null
      setPreview(null)
      setApplied(true)
      await invalidateDataset(client)
    },
    onError: () => {
      command.current.preview = null
      setPreview(null)
    },
    onSettled: () => {
      command.current.pending = false
    }
  })

  function invalidatePreview() {
    command.current.revision += 1
    command.current.preview = null
    setRevision(command.current.revision)
    setPreview(null)
  }
  function changeRatio(split: AssignedSplit, value: string) {
    if (command.current.pending) {
      return
    }
    setRatios((current) => ({ ...current, [split]: value }))
    invalidatePreview()
  }
  function changeReplacement(value: boolean) {
    if (command.current.pending) {
      return
    }
    setReplaceExisting(value)
    invalidatePreview()
  }
  function previewSplit() {
    if (command.current.pending || !canPreview || revision !== command.current.revision) {
      return
    }
    command.current.pending = true
    command.current.preview = null
    setPreview(null)
    generate.mutate({
      ratios: { train: Number(ratios.train), val: Number(ratios.val), test: Number(ratios.test) },
      replaceExisting
    })
  }
  function applySplit(value: SplitPreview) {
    if (
      command.current.pending ||
      value !== command.current.preview ||
      revision !== command.current.revision ||
      !valid
    ) {
      return
    }
    command.current.pending = true
    apply.mutate(value)
  }
  const valid =
    assignedSplits.every(
      (split) =>
        ratios[split].trim() !== '' && Number(ratios[split]) >= 0 && Number(ratios[split]) <= 100
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
    applySplit
  }
}

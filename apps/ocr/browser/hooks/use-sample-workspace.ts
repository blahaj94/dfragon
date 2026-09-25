import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { requestOcr } from '../client.js'
import { ocrKeys } from '../query.js'
import { useSampleFilters } from './use-sample-filters.js'
import type { Sample } from '../../src/model.js'

type SamplePage = { samples: Sample[]; nextOffset: number | null }
type CaptureStats = { captures: number; samples: number; pending: number; storedBytes: number }

export function useSampleWorkspace(authenticated: boolean | null) {
  const { filters, query, setFilter, setOffset } = useSampleFilters()
  const [selected, setSelected] = useState<string | null>(null)
  const page = useQuery({
    queryKey: ocrKeys.samples(filters),
    queryFn: ({ signal }) =>
      requestOcr<SamplePage>(`/api/samples?${query}`, 'GET', undefined, signal),
    enabled: authenticated === true
  })
  const stats = useQuery({
    queryKey: ocrKeys.stats,
    queryFn: ({ signal }) => requestOcr<CaptureStats>('/api/stats', 'GET', undefined, signal),
    enabled: authenticated === true
  })
  const samples = authenticated === true ? (page.data?.samples ?? []) : []
  const sample = samples.find((item) => item.id === selected) ?? samples[0]
  return {
    filters,
    setFilter,
    setOffset,
    setSelected,
    sample,
    samples,
    next: page.data?.nextOffset ?? null,
    stats: stats.data,
    error: page.error ?? stats.error
  }
}

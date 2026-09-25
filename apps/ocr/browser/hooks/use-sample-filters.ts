import { useState } from 'react'
import { buildSampleQuery, INITIAL_SAMPLE_FILTERS } from '../sample-query.js'
import type { SampleFilters } from '../sample-query.js'

export function useSampleFilters() {
  const [filters, setFilters] = useState(INITIAL_SAMPLE_FILTERS)
  const setFilter = (key: Exclude<keyof SampleFilters, 'offset'>, value: string) => {
    setFilters((current) => ({ ...current, [key]: value, offset: 0 }))
  }
  const setOffset = (offset: number) => setFilters((current) => ({ ...current, offset }))
  return { filters, query: buildSampleQuery(filters), setFilter, setOffset }
}

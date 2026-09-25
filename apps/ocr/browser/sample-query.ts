export type SampleFilters = { state: string; kind: string; split: string; offset: number }
export const INITIAL_SAMPLE_FILTERS: SampleFilters = { state: '', kind: '', split: '', offset: 0 }

export function buildSampleQuery(filters: SampleFilters): string {
  const query = new URLSearchParams({ offset: String(filters.offset) })
  for (const key of ['state', 'kind', 'split'] as const) {
    if (filters[key].length > 0) {
      query.set(key, filters[key])
    }
  }
  return query.toString()
}

import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { OCR_CACHE } from './constants.js'
import { OcrApiError } from './client.js'
import { OCR_ERROR_CODE } from '../src/errors.js'
import type { SampleFilters } from './sample-query.js'

export const ocrKeys = {
  session: ['ocr', 'session'] as const,
  dataset: ['ocr', 'dataset'] as const,
  samples: (filters: SampleFilters) => ['ocr', 'dataset', 'samples', filters] as const,
  stats: ['ocr', 'dataset', 'stats'] as const
}

export function createOcrQueryClient() {
  const clearExpiredSession = (error: unknown) => {
    if (error instanceof OcrApiError && error.code === OCR_ERROR_CODE.LOGIN_REQUIRED) {
      void client.cancelQueries()
      client.clear()
      client.setQueryData(ocrKeys.session, false)
    }
  }
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: clearExpiredSession }),
    mutationCache: new MutationCache({ onError: clearExpiredSession }),
    defaultOptions: {
      queries: { staleTime: OCR_CACHE.staleTimeMs, gcTime: OCR_CACHE.gcTimeMs, retry: false },
      mutations: { retry: false }
    }
  })
  return client
}

export function invalidateDataset(client: QueryClient) {
  return client.invalidateQueries({ queryKey: ocrKeys.dataset })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requestOcr, OcrApiError } from '../client.js'
import { OCR_ERROR_CODE } from '../../src/errors.js'
import { ocrKeys } from '../query.js'

export function useOcrSession() {
  const client = useQueryClient()
  const session = useQuery({
    queryKey: ocrKeys.session,
    queryFn: async ({ signal }) => {
      try {
        await requestOcr('/api/session', 'GET', undefined, signal)
        return true
      } catch (error) {
        if (error instanceof OcrApiError && error.code === OCR_ERROR_CODE.LOGIN_REQUIRED) {
          return false
        }
        throw error
      }
    }
  })
  const login = useMutation({
    mutationFn: () => requestOcr<{ url: string }>('/auth/login', 'POST'),
    onSuccess: (result) => {
      location.assign(result.url)
    }
  })
  const logout = useMutation({
    mutationFn: () => requestOcr('/auth/logout', 'POST'),
    onSuccess: async () => {
      await client.cancelQueries()
      client.clear()
      client.setQueryData(ocrKeys.session, false)
    }
  })
  return {
    authenticated: session.data ?? (session.isPending ? null : false),
    login,
    logout,
    error: login.error ?? logout.error ?? session.error
  }
}

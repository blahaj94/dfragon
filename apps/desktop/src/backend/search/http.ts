import { SEARCH_ERRORS } from '../../preload/common/types/search'
import type { SearchErrorCode } from '../../preload/common/types/search'

export class SearchHttpFailure extends Error {
  readonly retryAfterSeconds: number | null
  readonly retryAfterReceivedAt: number | null

  constructor(
    readonly code: SearchErrorCode,
    rateLimit: { retryAfterSeconds: number | null; retryAfterReceivedAt: number | null } = {
      retryAfterSeconds: null,
      retryAfterReceivedAt: null
    }
  ) {
    super(SEARCH_ERRORS[code].message)
    this.name = 'SearchHttpFailure'
    this.retryAfterSeconds = rateLimit.retryAfterSeconds
    this.retryAfterReceivedAt = rateLimit.retryAfterReceivedAt
  }
}

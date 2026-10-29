import { SEARCH_ERRORS } from '../../preload/common/types/search'
import type { SearchErrorCode } from '../../preload/common/types/search'

export class SearchHttpFailure extends Error {
  constructor(readonly code: SearchErrorCode) {
    super(SEARCH_ERRORS[code].message)
    this.name = 'SearchHttpFailure'
  }
}

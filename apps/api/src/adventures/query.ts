import { CharacterDetailFailure } from '../characters/details/errors.js'

export interface AdventureSearchQuery {
  adventureName: string
  limit: number
  after: string | null
}

const QUERY_ENCODED_SPACE_PATTERN = /\+/g
const ADVENTURE_NAME_CONTROL_PATTERN = /\p{Cc}/u
const ADVENTURE_RESULT_LIMIT_PATTERN = /^[0-9]+$/
const ADVENTURE_CURSOR_PATTERN = /^[a-zA-Z0-9_-]{1,256}$/

export function parseAdventureSearchQuery(originalUrl: string): AdventureSearchQuery {
  const separator = originalUrl.indexOf('?')
  if (separator < 0 || originalUrl.length > 4096) {
    throw new CharacterDetailFailure('query')
  }
  const values = new Map<string, string>()
  for (const component of originalUrl.slice(separator + 1).split('&')) {
    const equal = component.indexOf('=')
    if (equal < 1) {
      throw new CharacterDetailFailure('query')
    }
    let key: string, value: string
    try {
      key = decodeURIComponent(component.slice(0, equal).replace(QUERY_ENCODED_SPACE_PATTERN, ' '))
      value = decodeURIComponent(
        component.slice(equal + 1).replace(QUERY_ENCODED_SPACE_PATTERN, ' ')
      )
    } catch {
      throw new CharacterDetailFailure('query')
    }
    if (!['adventureName', 'limit', 'after'].includes(key) || values.has(key)) {
      throw new CharacterDetailFailure('query')
    }
    values.set(key, value)
  }
  const adventureName = values.get('adventureName')
  if (
    adventureName == null ||
    !adventureName.trim() ||
    [...adventureName].length > 100 ||
    ADVENTURE_NAME_CONTROL_PATTERN.test(adventureName)
  ) {
    throw new CharacterDetailFailure('query')
  }
  const rawLimit = values.get('limit') ?? '100'
  const limit = Number(rawLimit)
  if (!ADVENTURE_RESULT_LIMIT_PATTERN.test(rawLimit) || limit < 1 || limit > 100) {
    throw new CharacterDetailFailure('query')
  }
  const after = values.get('after') ?? null
  if (after != null && !ADVENTURE_CURSOR_PATTERN.test(after)) {
    throw new CharacterDetailFailure('query')
  }

  return { adventureName, limit, after }
}

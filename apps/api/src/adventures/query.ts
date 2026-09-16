import { CharacterDetailFailure } from '../characters/details/errors.js'

export interface AdventureSearchQuery {
  adventureName: string
  limit: number
  after: string | null
}

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
      key = decodeURIComponent(component.slice(0, equal).replace(/\+/g, ' '))
      value = decodeURIComponent(component.slice(equal + 1).replace(/\+/g, ' '))
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
    /\p{Cc}/u.test(adventureName)
  ) {
    throw new CharacterDetailFailure('query')
  }
  const rawLimit = values.get('limit') ?? '100'
  const limit = Number(rawLimit)
  if (!/^[0-9]+$/.test(rawLimit) || limit < 1 || limit > 100) {
    throw new CharacterDetailFailure('query')
  }
  const after = values.get('after') ?? null
  if (after != null && !/^[a-zA-Z0-9_-]{1,256}$/.test(after)) {
    throw new CharacterDetailFailure('query')
  }
  return { adventureName, limit, after }
}

import { matchesDNFSearchNicknamePolicy } from '@dfragon/lib'
import { NEOPLE_SERVER_NAMES } from '../constants/neople-character-search.js'
import { NeopleSearchFailure } from '../errors/neople-search.js'
import type { NeopleCharacterSearchInput } from '../types/neople-character-search.js'

type DecodedQueryPair = { key: string; value: string }

export function parseCharacterSearchQuery(originalUrl: string): NeopleCharacterSearchInput {
  const pairs = decodeRawQuery(originalUrl)

  return validateSearchQuery(pairs)
}

export function parseCharacterCandidatesQuery(originalUrl: string): NeopleCharacterSearchInput {
  const pairs = decodeRawQuery(originalUrl)
  const pair = pairs[0]
  if (pairs.length !== 1 || pair?.key !== 'characterName') {
    throw new NeopleSearchFailure('query')
  }
  const characterName = pair.value
  const length = [...characterName].length
  if (length < 1 || length > 12 || characterName !== characterName.trim()) {
    throw new NeopleSearchFailure('query')
  }

  return { characterName, serverId: 'all', limit: 200, wordType: 'match' }
}

const QUERY_ENCODED_SPACE_PATTERN = /\+/g

function decodeQueryPart(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(QUERY_ENCODED_SPACE_PATTERN, ' '))
  } catch {
    throw new NeopleSearchFailure('query')
  }
}

function decodeRawQuery(originalUrl: string): DecodedQueryPair[] {
  const questionMarkIndex = originalUrl.indexOf('?')
  if (questionMarkIndex < 0) {
    throw new NeopleSearchFailure('query')
  }

  // Map으로 바꾸기 전에 모든 pair를 보존해야 decoded key의 중복을 검증할 수 있다.
  const pairs: DecodedQueryPair[] = []
  for (const component of originalUrl.slice(questionMarkIndex + 1).split('&')) {
    if (component.length === 0) {
      throw new NeopleSearchFailure('query')
    }
    const equalsIndex = component.indexOf('=')
    const hasEquals = equalsIndex >= 0
    const key = decodeQueryPart(hasEquals ? component.slice(0, equalsIndex) : component)
    const value = decodeQueryPart(hasEquals ? component.slice(equalsIndex + 1) : '')
    pairs.push({ key, value })
  }

  return pairs
}

const CHARACTER_RESULT_LIMIT_PATTERN = /^[0-9]+$/

function validateSearchQuery(pairs: readonly DecodedQueryPair[]): NeopleCharacterSearchInput {
  const values = new Map<string, string>()
  for (const { key, value } of pairs) {
    if (!['characterName', 'serverId', 'limit'].includes(key) || values.has(key)) {
      throw new NeopleSearchFailure('query')
    }
    values.set(key, value)
  }

  const characterName = values.get('characterName')
  if (characterName === undefined || !matchesDNFSearchNicknamePolicy(characterName)) {
    throw new NeopleSearchFailure('query')
  }

  const serverId = values.get('serverId') ?? 'all'
  if (serverId !== 'all' && !NEOPLE_SERVER_NAMES.has(serverId)) {
    throw new NeopleSearchFailure('query')
  }

  const rawLimit = values.get('limit') ?? '10'
  const limit = Number(rawLimit)
  if (!CHARACTER_RESULT_LIMIT_PATTERN.test(rawLimit) || limit < 1 || limit > 200) {
    throw new NeopleSearchFailure('query')
  }

  return { characterName, serverId, limit }
}

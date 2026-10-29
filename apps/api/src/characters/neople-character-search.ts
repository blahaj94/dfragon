import { assert } from '@dfragon/lib/utils/assert'
import {
  isFiniteNumber,
  isNonblankString,
  isRecord,
  textOrNull
} from '@dfragon/lib/utils/shape-check'
import ky, { isTimeoutError } from 'ky'
import { NEOPLE_ORIGIN, NEOPLE_SERVER_NAMES } from '../constants/neople-character-search.js'
import {
  classifyNeopleUpstreamFailure,
  neopleStatusFailure,
  NeopleSearchFailure
} from '../errors/neople-search.js'
import { CHARACTER_ID_PATTERN } from './identity.js'
import type {
  CharacterSearchRow,
  NeopleCharacterSearchResult,
  NeopleCharacterSearchInput,
  NeopleCharacterSearchTestDependencies,
  SearchCharacters,
  SearchDependencies
} from '../types/neople-character-search.js'

const nativeDependencies: SearchDependencies = {
  origin: NEOPLE_ORIGIN
}

const invalidResponse = (): NeopleSearchFailure => new NeopleSearchFailure('api')

function projectRow(candidate: unknown, input: NeopleCharacterSearchInput): CharacterSearchRow {
  assert(isRecord(candidate), invalidResponse)

  const { characterId, characterName, serverId, fame } = candidate
  assert(isNonblankString(characterId), invalidResponse)
  assert(isNonblankString(characterName), invalidResponse)
  assert(isNonblankString(serverId), invalidResponse)
  assert(fame == null || isFiniteNumber(fame), invalidResponse)

  // Neople match ignores letter case, so a name differing only in case is a valid response row.
  if (input.wordType === 'match') {
    assert(characterName.toLowerCase() === input.characterName.toLowerCase(), invalidResponse)
    assert(NEOPLE_SERVER_NAMES.has(serverId), invalidResponse)
    assert(CHARACTER_ID_PATTERN.test(characterId), invalidResponse)
  }

  const serverName = NEOPLE_SERVER_NAMES.get(serverId) ?? null
  const knownFame = isFiniteNumber(fame) ? fame : null
  const jobName = textOrNull(candidate.jobName)
  const jobGrowName = textOrNull(candidate.jobGrowName)

  return {
    characterId,
    characterName,
    serverId,
    serverName,
    fame: knownFame,
    jobName,
    jobGrowName
  }
}

function projectResponse(
  body: unknown,
  status: number,
  ok: boolean,
  input: NeopleCharacterSearchInput
): NeopleCharacterSearchResult {
  const upstreamFailure = classifyNeopleUpstreamFailure(body, status, ok)
  if (upstreamFailure !== undefined) {
    throw upstreamFailure
  }

  assert(isRecord(body), invalidResponse)
  assert(Array.isArray(body.rows), invalidResponse)

  const rows = body.rows.map((candidate: unknown) => projectRow(candidate, input))
  if (input.wordType === 'match') {
    const exactRows = rows.filter((row) => row.characterName === input.characterName)

    return { rows: exactRows }
  }

  return { rows }
}

function parseBody(rawBody: string, status: number): unknown {
  try {
    return JSON.parse(rawBody) as unknown
  } catch (error) {
    throw neopleStatusFailure(status, { cause: error })
  }
}

function makeSearch(apiKey: string, dependencies: SearchDependencies): SearchCharacters {
  const neople = ky.create({
    baseUrl: dependencies.origin,
    fetch: dependencies.fetch,
    headers: { apikey: apiKey },
    redirect: 'manual',
    retry: 0,
    throwHttpErrors: false
  })

  return async (input) => {
    try {
      return await neople
        .get(`/df/servers/${encodeURIComponent(input.serverId)}/characters`, {
          searchParams: {
            characterName: input.characterName,
            limit: input.limit,
            wordType: input.wordType ?? 'full'
          },
          // Only parseJson sees the response status while ky's .json() keeps its timeout on the body read.
          // Reading response.text() directly after awaiting the request would leave the body unbounded.
          parseJson: (rawBody, { response }) =>
            projectResponse(
              parseBody(rawBody, response.status),
              response.status,
              response.ok,
              input
            )
        })
        .json<NeopleCharacterSearchResult>()
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new NeopleSearchFailure('timeout')
      }

      const failure =
        error instanceof NeopleSearchFailure
          ? error
          : new NeopleSearchFailure('api', { cause: error })
      throw failure
    }
  }
}

export function createNeopleCharacterSearch(apiKey: string): SearchCharacters {
  return makeSearch(apiKey, nativeDependencies)
}

export function createNeopleCharacterSearchForTest(
  apiKey: string,
  overrides: NeopleCharacterSearchTestDependencies
): SearchCharacters {
  return makeSearch(apiKey, { ...nativeDependencies, ...overrides })
}

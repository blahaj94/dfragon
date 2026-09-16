import {
  NEOPLE_ORIGIN,
  NEOPLE_SEARCH_DEADLINE_MS
} from '../../constants/neople-character-search.js'
import {
  NeopleSearchFailure,
  classifyNeopleUpstreamFailure,
  neopleStatusFailure
} from '../../errors/neople-search.js'
import { CharacterDetailFailure, characterDetailFailure } from './errors.js'
import { CHARACTER_DETAIL_SECTIONS, characterDetailSections } from './sections.js'
import type {
  CharacterDetailSection,
  CharacterIdentity,
  CharacterPayload,
  CharacterPayloads
} from './sections.js'

export function isObject(value: unknown): value is CharacterPayload {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const sectionFields: Record<CharacterDetailSection, readonly string[]> = {
  basic: [],
  status: ['status', 'buff'],
  equipment: ['equipment', 'setItemInfo'],
  avatar: ['avatar'],
  creature: ['creature'],
  oath: ['oath'],
  mist_assimilation: ['mistAssimilation'],
  skill_style: ['skill'],
  buff_equipment: ['skill'],
  buff_avatar: ['skill'],
  buff_creature: ['skill']
}

export function validateCharacterPayload(
  body: unknown,
  identity: CharacterIdentity,
  section: CharacterDetailSection
): CharacterPayload {
  if (
    !isObject(body) ||
    body.characterId !== identity.characterId ||
    body.serverId !== identity.serverId ||
    typeof body.characterName !== 'string' ||
    body.characterName.trim() === ''
  ) {
    throw new CharacterDetailFailure('api')
  }
  // Seasonal nested options remain intact; only the section envelope is required here.
  for (const field of sectionFields[section]) {
    if (!Object.hasOwn(body, field) || (body[field] !== null && typeof body[field] !== 'object')) {
      throw new CharacterDetailFailure('api')
    }
  }
  return body
}

export type FetchCharacterDetails = (
  identity: CharacterIdentity,
  signal: AbortSignal
) => Promise<CharacterPayloads>

interface TransportDependencies {
  fetch: typeof globalThis.fetch
  origin: string
  timeoutMs: number
}

function makeAdapter(apiKey: string, deps: TransportDependencies): FetchCharacterDetails {
  return async (identity, requestSignal) => {
    const timeout = AbortSignal.timeout(deps.timeoutMs)
    const failureController = new AbortController()
    const signal = AbortSignal.any([requestSignal, timeout, failureController.signal])
    const startedAt = performance.now()
    const results = {} as CharacterPayloads
    const load = async (section: CharacterDetailSection): Promise<void> => {
      signal.throwIfAborted()
      const path = `/df/servers/${encodeURIComponent(identity.serverId)}/characters/${encodeURIComponent(identity.characterId)}${CHARACTER_DETAIL_SECTIONS[section]}`
      const response = await deps.fetch(new URL(path, deps.origin), {
        headers: { apikey: apiKey },
        redirect: 'error',
        signal
      })
      let body: unknown
      try {
        body = await response.json()
      } catch {
        throw neopleStatusFailure(response.status)
      }
      const failure = classifyNeopleUpstreamFailure(body, response.status, response.ok)
      if (failure) {
        throw failure
      }
      results[section] = validateCharacterPayload(body, identity, section)
    }
    try {
      // Confirm identity before spending the other ten provider requests.
      await load('basic')
      const sections = characterDetailSections.filter((section) => section !== 'basic')
      for (let index = 0; index < sections.length; index += 3) {
        await Promise.all(sections.slice(index, index + 3).map(load))
      }
      signal.throwIfAborted()
      if (performance.now() - startedAt >= deps.timeoutMs) {
        throw new CharacterDetailFailure('timeout')
      }
      return results
    } catch (error) {
      failureController.abort()
      if (timeout.aborted || performance.now() - startedAt >= deps.timeoutMs) {
        throw new CharacterDetailFailure('timeout')
      }
      if (requestSignal.aborted) {
        throw new CharacterDetailFailure('internal')
      }
      if (error instanceof CharacterDetailFailure) {
        throw error
      }
      const failure = characterDetailFailure(error)
      // Transport failures are upstream failures, not an internal exception reflection.
      throw error instanceof NeopleSearchFailure ? failure : new CharacterDetailFailure('api')
    }
  }
}

export function createNeopleCharacterDetails(apiKey: string): FetchCharacterDetails {
  return makeAdapter(apiKey, {
    fetch: globalThis.fetch,
    origin: NEOPLE_ORIGIN,
    timeoutMs: NEOPLE_SEARCH_DEADLINE_MS
  })
}

export function createNeopleCharacterDetailsForTest(
  apiKey: string,
  deps: Partial<TransportDependencies>
): FetchCharacterDetails {
  return makeAdapter(apiKey, {
    fetch: globalThis.fetch,
    origin: NEOPLE_ORIGIN,
    timeoutMs: NEOPLE_SEARCH_DEADLINE_MS,
    ...deps
  })
}

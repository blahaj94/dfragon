import { isRecord } from '@dfragon/lib/utils/shape-check'
import ky, { isTimeoutError } from 'ky'
import { NEOPLE_ORIGIN } from '../../constants/neople-character-search.js'
import {
  classifyNeopleUpstreamFailure,
  neopleStatusFailureKind
} from '../../errors/neople-search.js'
import type { FetchTransport } from '../../types/neople-character-search.js'
import { CharacterDetailFailure } from './errors.js'
import { type RecordNeopleStage, elapsedMs } from './neople-stages.js'
import { CHARACTER_DETAIL_SECTIONS, characterDetailSections } from './sections.js'
import type {
  CharacterDetailSection,
  CharacterIdentity,
  CharacterPayload,
  CharacterPayloads
} from './sections.js'

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
    !isRecord(body) ||
    body.characterId !== identity.characterId ||
    body.serverId !== identity.serverId ||
    typeof body.characterName !== 'string' ||
    body.characterName.trim() === ''
  ) {
    throw new CharacterDetailFailure('api')
  }
  for (const field of sectionFields[section]) {
    if (!Object.hasOwn(body, field) || (body[field] !== null && typeof body[field] !== 'object')) {
      throw new CharacterDetailFailure('api')
    }
  }

  return body
}

export type FetchCharacterDetails = (
  identity: CharacterIdentity,
  signal: AbortSignal,
  recordStage: RecordNeopleStage
) => Promise<CharacterPayloads>

interface TransportDependencies {
  fetch?: FetchTransport
  origin: string
}

function parseBody(rawBody: string, status: number): unknown {
  try {
    return JSON.parse(rawBody) as unknown
  } catch (error) {
    throw new CharacterDetailFailure(neopleStatusFailureKind(status), { cause: error })
  }
}

function makeAdapter(apiKey: string, deps: TransportDependencies): FetchCharacterDetails {
  const neople = ky.create({
    baseUrl: deps.origin,
    fetch: deps.fetch,
    headers: { apikey: apiKey },
    redirect: 'error',
    retry: 0,
    throwHttpErrors: false
  })

  return async (identity, requestSignal, recordStage) => {
    const failureController = new AbortController()
    const signal = AbortSignal.any([requestSignal, failureController.signal])
    const results = {} as CharacterPayloads
    const load = async (section: CharacterDetailSection): Promise<void> => {
      const path = `/df/servers/${encodeURIComponent(identity.serverId)}/characters/${encodeURIComponent(identity.characterId)}${CHARACTER_DETAIL_SECTIONS[section]}`
      results[section] = await neople
        .get(path, {
          signal,
          parseJson: (rawBody, { response }) => {
            const body = parseBody(rawBody, response.status)
            const failure = classifyNeopleUpstreamFailure(body, response.status, response.ok)
            if (failure) {
              throw new CharacterDetailFailure(failure)
            }

            return validateCharacterPayload(body, identity, section)
          }
        })
        .json<CharacterPayload>()
    }
    try {
      // ky hands an already aborted request to fetch, so a cancelled request stops before any transport.
      requestSignal.throwIfAborted()
      // Confirm identity before spending the other ten provider requests.
      const basicStartedAt = performance.now()
      await load('basic')
      recordStage('basic', elapsedMs(basicStartedAt))
      const sections = characterDetailSections.filter((section) => section !== 'basic')
      const sectionsStartedAt = performance.now()
      await Promise.all(sections.map(load))
      recordStage('sections', elapsedMs(sectionsStartedAt))

      return results
    } catch (error) {
      failureController.abort()
      if (isTimeoutError(error)) {
        throw new CharacterDetailFailure('timeout')
      }

      if (requestSignal.aborted) {
        throw new CharacterDetailFailure('internal')
      }

      if (error instanceof CharacterDetailFailure) {
        throw error
      }
      throw new CharacterDetailFailure('api', { cause: error })
    }
  }
}

export function createNeopleCharacterDetails(apiKey: string): FetchCharacterDetails {
  return makeAdapter(apiKey, { origin: NEOPLE_ORIGIN })
}

export function createNeopleCharacterDetailsForTest(
  apiKey: string,
  deps: Partial<TransportDependencies>
): FetchCharacterDetails {
  return makeAdapter(apiKey, { origin: NEOPLE_ORIGIN, ...deps })
}

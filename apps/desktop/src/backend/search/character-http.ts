import { z } from 'zod'
import { fetchApi } from '../api-fetch'
import { validateApiOrigin } from '../auth/protocol'
import type { AuthClock } from '../auth/types'
import type { CharacterAppearance } from '../../preload/common/types/appearance'
import type {
  CharacterCandidate,
  CharacterDetails,
  CharacterIdentity,
  CharacterImage
} from '../../preload/common/types/character'
import type { SearchErrorCode } from '../../preload/common/types/search'
import { SearchHttpFailure } from './http'
import { CHARACTER_IMAGE_LIMITS, decodeCharacterImage } from './character-image'
import {
  createCharacterHttpClient,
  parseCharacterJson,
  parseCharacterRetryAfter,
  readCharacterResponseBody,
  throwCharacterTransportFailure
} from './character-response'
import {
  CHARACTER_SERVER_NAMES as SERVER_NAMES,
  characterIdentitySchema as identitySchema,
  characterImageUrl
} from '../../preload/common/search/character-summary'

const MAX_CHARACTER_NAME_CODE_POINTS = 12
export const CHARACTER_HTTP_LIMITS = {
  candidateJsonBytes: 256 * 1024,
  detailJsonBytes: 8 * 1024 * 1024,
  appearanceJsonBytes: 256 * 1024,
  ...CHARACTER_IMAGE_LIMITS
} as const

const nonblank = z.string().refine((value) => value.trim().length > 0)
const appearanceCloneSchema = z
  .object({ itemId: nonblank.nullable(), itemName: nonblank.nullable() })
  .refine((clone) => (clone.itemId === null) === (clone.itemName === null))
const appearanceSchema = identitySchema.extend({
  characterName: nonblank,
  jobName: nonblank,
  jobGrowName: nonblank,
  avatar: z.array(
    z.object({
      slotId: nonblank,
      itemId: nonblank,
      itemName: nonblank,
      clone: appearanceCloneSchema
    })
  )
})
const candidateSchema = identitySchema
  .extend({
    characterName: nonblank,
    serverName: z.string(),
    fame: z.number().nullable(),
    imageUrl: z.string()
  })
  .refine(
    (candidate) =>
      candidate.serverName === SERVER_NAMES[candidate.serverId] &&
      candidate.imageUrl === characterImageUrl(candidate)
  )
const candidatesSchema = z.object({ rows: z.array(candidateSchema) })
const sectionMetadataSchema = z.object({
  revision: z.number().int().positive(),
  contentUpdatedAt: z.iso.datetime(),
  lastSuccessfulFetchAt: z.iso.datetime()
})
const detailsSchema = z
  .object({
    character: identitySchema
      .extend({ characterName: nonblank, serverName: z.string() })
      .catchall(z.json())
      .refine((character) => character.serverName === SERVER_NAMES[character.serverId]),
    status: z.object({ status: z.json(), buff: z.json() }),
    equipment: z.object({ equipment: z.json(), setItemInfo: z.json() }),
    avatar: z.json(),
    creature: z.json(),
    oath: z.json(),
    mistAssimilation: z.json(),
    skillStyle: z.json(),
    buff: z.object({ equipment: z.json(), avatar: z.json(), creature: z.json() }),
    sections: z.object({
      basic: sectionMetadataSchema,
      status: sectionMetadataSchema,
      equipment: sectionMetadataSchema,
      avatar: sectionMetadataSchema,
      creature: sectionMetadataSchema,
      oath: sectionMetadataSchema,
      mist_assimilation: sectionMetadataSchema,
      skill_style: sectionMetadataSchema,
      buff_equipment: sectionMetadataSchema,
      buff_avatar: sectionMetadataSchema,
      buff_creature: sectionMetadataSchema
    }),
    freshness: z.object({ lastSuccessfulFetchAt: z.iso.datetime(), expiresAt: z.iso.datetime() })
  })
  .catchall(z.json())
const failureSchema = z.object({ error: z.object({ code: z.string() }) })
const statusErrors: Readonly<Partial<Record<number, SearchErrorCode>>> = {
  400: 'INVALID_SEARCH_QUERY',
  429: 'SEARCH_RATE_LIMITED',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'NEOPLE_API_ERROR',
  503: 'NEOPLE_UNAVAILABLE',
  504: 'NEOPLE_TIMEOUT'
}

type TransportOptions = { fetch?: typeof fetch }
type ApiOptions = TransportOptions & { apiOrigin: string; clock?: Pick<AuthClock, 'read'> }
type IdentityRequest = CharacterIdentity & { signal: AbortSignal }
export type CharacterCandidatesHttp = (input: {
  nickname: string
  signal: AbortSignal
}) => Promise<readonly CharacterCandidate[]>
export type CharacterImageHttp = (input: IdentityRequest) => Promise<CharacterImage>
export type CharacterDetailsHttp = (input: IdentityRequest) => Promise<CharacterDetails>
export type CharacterAppearanceHttp = (input: IdentityRequest) => Promise<CharacterAppearance>

function validateIdentity(identity: CharacterIdentity): void {
  if (!identitySchema.safeParse(identity).success) {
    throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
  }
}

function validateNickname(nickname: string): void {
  const length = Array.from(nickname).length
  if (length < 1 || length > MAX_CHARACTER_NAME_CODE_POINTS || nickname !== nickname.trim()) {
    throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
  }
  try {
    encodeURIComponent(nickname)
  } catch {
    throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
  }
}

function assertApiSuccess(
  response: Response,
  body: unknown,
  receivedAt: number,
  details: boolean
): void {
  if (response.status === 200) {
    if (body != null && typeof body === 'object' && Object.hasOwn(body, 'error')) {
      throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
    }

    return
  }
  const code = statusErrors[response.status]
  let expectedCode: string | undefined = code
  if (details && response.status === 400) {
    expectedCode = 'INVALID_CHARACTER_QUERY'
  } else if (details && response.status === 429) {
    expectedCode = 'CHARACTER_RATE_LIMITED'
  }
  const failure = failureSchema.safeParse(body)
  if (!code || !failure.success || failure.data.error.code !== expectedCode) {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
  const limited = code === 'SEARCH_RATE_LIMITED'
  const retryAfterSeconds = limited
    ? parseCharacterRetryAfter(response.headers.get('Retry-After'))
    : null
  const retryAfterReceivedAt = limited ? receivedAt : null
  throw new SearchHttpFailure(code, { retryAfterSeconds, retryAfterReceivedAt })
}

/** OCR 이름 하나를 정확히 검색하고 API가 정한 명성과 null 후보 순서를 유지한다. */
export function createCharacterCandidatesHttp({
  apiOrigin,
  fetch: transport = fetchApi,
  clock
}: ApiOptions): CharacterCandidatesHttp {
  const origin = validateApiOrigin(apiOrigin)
  const client = createCharacterHttpClient(transport)

  return async ({ nickname, signal }) => {
    validateNickname(nickname)
    try {
      signal.throwIfAborted()
      const response = await client.get(`${origin}/characters/candidates`, {
        searchParams: { characterName: nickname },
        headers: { Accept: 'application/json' },
        signal
      })
      const receivedAt = clock?.read().monotonicMs ?? performance.now()
      const body = parseCharacterJson(
        await readCharacterResponseBody(response, signal, CHARACTER_HTTP_LIMITS.candidateJsonBytes)
      )
      assertApiSuccess(response, body, receivedAt, false)
      const parsed = candidatesSchema.safeParse(body)
      if (!parsed.success || parsed.data.rows.some((row) => row.characterName !== nickname)) {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
      signal.throwIfAborted()

      return parsed.data.rows
    } catch (error) {
      throwCharacterTransportFailure(error, signal)
    }
  }
}

/** 검증한 식별자로 고정 네오플 캐릭터 이미지 경로를 구성해 다운로드한다. */
export function createCharacterImageHttp({
  fetch: transport = fetchApi
}: TransportOptions = {}): CharacterImageHttp {
  const client = createCharacterHttpClient(transport)

  return async ({ serverId, characterId, signal }) => {
    const identity = { serverId, characterId }
    validateIdentity(identity)
    try {
      signal.throwIfAborted()
      const response = await client.get(characterImageUrl(identity), {
        headers: { Accept: 'image/png' },
        signal
      })
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => undefined)
        throw new SearchHttpFailure('NEOPLE_API_ERROR')
      }
      const bytes = await readCharacterResponseBody(
        response,
        signal,
        CHARACTER_HTTP_LIMITS.imageBytes
      )
      const contentType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
      if (contentType !== 'image/png') {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
      const image = decodeCharacterImage(bytes)
      signal.throwIfAborted()

      return image
    } catch (error) {
      throwCharacterTransportFailure(error, signal)
    }
  }
}

/** 선택한 캐릭터의 식별자를 확인하고 시즌별 섹션 JSON을 보존한다. */
export function createCharacterDetailsHttp({
  apiOrigin,
  fetch: transport = fetchApi,
  clock
}: ApiOptions): CharacterDetailsHttp {
  const origin = validateApiOrigin(apiOrigin)
  const client = createCharacterHttpClient(transport)

  return async ({ serverId, characterId, signal }) => {
    validateIdentity({ serverId, characterId })
    try {
      signal.throwIfAborted()
      const response = await client.get(`${origin}/characters/${serverId}/${characterId}`, {
        headers: { Accept: 'application/json' },
        signal
      })
      const receivedAt = clock?.read().monotonicMs ?? performance.now()
      const body = parseCharacterJson(
        await readCharacterResponseBody(response, signal, CHARACTER_HTTP_LIMITS.detailJsonBytes)
      )
      assertApiSuccess(response, body, receivedAt, true)
      const parsed = detailsSchema.safeParse(body)
      if (
        !parsed.success ||
        parsed.data.character.serverId !== serverId ||
        parsed.data.character.characterId !== characterId
      ) {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
      signal.throwIfAborted()

      return parsed.data
    } catch (error) {
      throwCharacterTransportFailure(error, signal)
    }
  }
}

/** 표시용 상세가 보강되기 전의 아바타 외형만 읽고 선택한 식별자를 확인한다. */
export function createCharacterAppearanceHttp({
  apiOrigin,
  fetch: transport = fetchApi,
  clock
}: ApiOptions): CharacterAppearanceHttp {
  const origin = validateApiOrigin(apiOrigin)
  const client = createCharacterHttpClient(transport)

  return async ({ serverId, characterId, signal }) => {
    validateIdentity({ serverId, characterId })
    try {
      signal.throwIfAborted()
      const response = await client.get(
        `${origin}/characters/${serverId}/${characterId}/appearance`,
        {
          headers: { Accept: 'application/json' },
          signal
        }
      )
      const receivedAt = clock?.read().monotonicMs ?? performance.now()
      const body = parseCharacterJson(
        await readCharacterResponseBody(response, signal, CHARACTER_HTTP_LIMITS.appearanceJsonBytes)
      )
      assertApiSuccess(response, body, receivedAt, true)
      const parsed = appearanceSchema.safeParse(body)
      if (
        !parsed.success ||
        parsed.data.serverId !== serverId ||
        parsed.data.characterId !== characterId
      ) {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
      signal.throwIfAborted()

      return parsed.data
    } catch (error) {
      throwCharacterTransportFailure(error, signal)
    }
  }
}

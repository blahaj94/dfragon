import { z } from 'zod'
import { fetchApi } from '../api-fetch'
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
  ...CHARACTER_IMAGE_LIMITS
} as const

const nonblank = z.string().refine((value) => value.trim().length > 0)
const candidateSchema = identitySchema
  .extend({
    characterName: nonblank,
    serverName: z.string(),
    fame: z.number().nullable(),
    imageUrl: z.string(),
    // 모험단명, 직업명을 보내기 전의 API와도 호환하도록 없으면 null로 받는다.
    adventureName: z.string().nullable().default(null),
    jobName: z.string().nullable().default(null),
    jobGrowName: z.string().nullable().default(null)
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
type ApiOptions = TransportOptions & { apiOrigin: string }
type IdentityRequest = CharacterIdentity & { signal: AbortSignal }
export type CharacterCandidatesHttp = (input: {
  nickname: string
  signal: AbortSignal
}) => Promise<readonly CharacterCandidate[]>
export type CharacterImageHttp = (input: IdentityRequest) => Promise<CharacterImage>
export type CharacterDetailsHttp = (input: IdentityRequest) => Promise<CharacterDetails>

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

function expectedErrorCode(status: number, details: boolean): string | undefined {
  if (details && status === 400) {
    return 'INVALID_CHARACTER_QUERY'
  }

  if (details && status === 429) {
    return 'CHARACTER_RATE_LIMITED'
  }

  return statusErrors[status]
}

function assertApiSuccess(response: Response, body: unknown, details: boolean): void {
  if (response.status === 200) {
    if (body != null && typeof body === 'object' && Object.hasOwn(body, 'error')) {
      throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
    }

    return
  }
  const code = statusErrors[response.status]
  const expectedCode = expectedErrorCode(response.status, details)
  const failure = failureSchema.safeParse(body)
  if (!code || !failure.success || failure.data.error.code !== expectedCode) {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
  throw new SearchHttpFailure(code)
}

export function createCharacterCandidatesHttp({
  apiOrigin,
  fetch: transport = fetchApi
}: ApiOptions): CharacterCandidatesHttp {
  const client = createCharacterHttpClient(transport, CHARACTER_HTTP_LIMITS.candidateJsonBytes)

  return async ({ nickname, signal }) => {
    validateNickname(nickname)
    try {
      signal.throwIfAborted()
      const request = client.get(`${apiOrigin}/characters/candidates`, {
        searchParams: { characterName: nickname },
        headers: { Accept: 'application/json' },
        signal
      })
      const response = await request
      // ky의 body 메서드만 본문 읽기에도 timeout을 건다. await한 Response의 본문을 직접 읽으면 대기 상한이 없다.
      const body = parseCharacterJson(await request.arrayBuffer())
      assertApiSuccess(response, body, false)
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

export function createCharacterImageHttp({
  fetch: transport = fetchApi
}: TransportOptions = {}): CharacterImageHttp {
  const client = createCharacterHttpClient(transport, CHARACTER_HTTP_LIMITS.imageBytes)

  return async ({ serverId, characterId, signal }) => {
    const identity = { serverId, characterId }
    validateIdentity(identity)
    try {
      signal.throwIfAborted()
      const request = client.get(characterImageUrl(identity), {
        headers: { Accept: 'image/png' },
        signal
      })
      const response = await request
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => undefined)
        if (response.status === 429) {
          throw new SearchHttpFailure('SEARCH_RATE_LIMITED')
        }
        throw new SearchHttpFailure('NEOPLE_API_ERROR')
      }
      // ky의 body 메서드만 본문 읽기에도 timeout을 건다.
      const bytes = Buffer.from(await request.arrayBuffer())
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

export function createCharacterDetailsHttp({
  apiOrigin,
  fetch: transport = fetchApi
}: ApiOptions): CharacterDetailsHttp {
  const client = createCharacterHttpClient(transport, CHARACTER_HTTP_LIMITS.detailJsonBytes)

  return async ({ serverId, characterId, signal }) => {
    validateIdentity({ serverId, characterId })
    try {
      signal.throwIfAborted()
      const request = client.get(`${apiOrigin}/characters/${serverId}/${characterId}`, {
        headers: { Accept: 'application/json' },
        signal
      })
      const response = await request
      // ky의 body 메서드만 본문 읽기에도 timeout을 건다.
      const body = parseCharacterJson(await request.arrayBuffer())
      assertApiSuccess(response, body, true)
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

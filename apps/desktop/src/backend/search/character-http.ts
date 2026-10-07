import ky from 'ky'
import { inflateSync } from 'node:zlib'
import { PNG } from 'pngjs'
import { z } from 'zod'
import { fetchApi } from '../api-fetch'
import { validateApiOrigin } from '../auth/protocol'
import type { AuthClock } from '../auth/types'
import type {
  CharacterCandidate,
  CharacterDetails,
  CharacterIdentity,
  CharacterImage
} from '../../preload/common/types/character'
import type { SearchErrorCode } from '../../preload/common/types/search'
import { SearchHttpFailure } from './http'
import {
  CHARACTER_SERVER_NAMES as SERVER_NAMES,
  characterIdentitySchema as identitySchema,
  characterImageUrl
} from '../../preload/common/search/character-summary'

const RETRY_AFTER_SECONDS_PATTERN = /^[0-9]+$/
const MAX_CHARACTER_NAME_CODE_POINTS = 12
const PNG_SIGNATURE_HEX = '89504e470d0a1a0a'
const PNG_HEADER_BYTES = 33
const PNG_IHDR_LENGTH = 13
const PNG_CHUNK_OVERHEAD_BYTES = 12
const PNG_MAX_BYTES_PER_PIXEL = 8
const PNG_INTERLACE_PASSES = 7
const RGBA_CHANNELS = 4

export const CHARACTER_HTTP_LIMITS = {
  candidateJsonBytes: 256 * 1024,
  detailJsonBytes: 8 * 1024 * 1024,
  imageBytes: 4 * 1024 * 1024,
  imageDimension: 2048,
  imagePixels: 1024 * 1024
} as const

const nonblank = z.string().refine((value) => value.trim().length > 0)
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

function createClient(transport: typeof fetch): ReturnType<typeof ky.create> {
  return ky.create({
    fetch: transport,
    retry: 0,
    timeout: false,
    totalTimeout: false,
    throwHttpErrors: false,
    redirect: 'error',
    credentials: 'omit',
    cache: 'no-store'
  })
}

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

function parseRetryAfter(value: string | null): number | null {
  if (value == null || !RETRY_AFTER_SECONDS_PATTERN.test(value)) {
    return null
  }
  const seconds = Number(value)
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    return null
  }

  return seconds
}

/** 호출자의 공통 요청 시간 예산이 끝나면 지연된 응답 본문 읽기도 취소한다. */
async function readBody(response: Response, signal: AbortSignal, limit: number): Promise<Buffer> {
  if (!response.body) {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
  const reader = response.body.getReader()
  const cancel = (): void => {
    void reader.cancel().catch(() => undefined)
  }
  signal.addEventListener('abort', cancel, { once: true })
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    signal.throwIfAborted()
    while (true) {
      const chunk = await reader.read()
      signal.throwIfAborted()
      if (chunk.done) {
        break
      }
      length += chunk.value.length
      if (length > limit) {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
      chunks.push(chunk.value)
    }

    return Buffer.concat(chunks, length)
  } finally {
    signal.removeEventListener('abort', cancel)
    await reader.cancel().catch(() => undefined)
  }
}

function parseJson(bytes: Buffer): unknown {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)

    return JSON.parse(text)
  } catch {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
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
  const retryAfterSeconds = limited ? parseRetryAfter(response.headers.get('Retry-After')) : null
  const retryAfterReceivedAt = limited ? receivedAt : null
  throw new SearchHttpFailure(code, { retryAfterSeconds, retryAfterReceivedAt })
}

function transportFailure(error: unknown, signal: AbortSignal): never {
  signal.throwIfAborted()
  if (error instanceof SearchHttpFailure) {
    throw error
  }
  throw new SearchHttpFailure('SEARCH_NETWORK_ERROR')
}

/** OCR 이름 하나를 정확히 검색하고 API가 정한 명성과 null 후보 순서를 유지한다. */
export function createCharacterCandidatesHttp({
  apiOrigin,
  fetch: transport = fetchApi,
  clock
}: ApiOptions): CharacterCandidatesHttp {
  const origin = validateApiOrigin(apiOrigin)
  const client = createClient(transport)

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
      const body = parseJson(
        await readBody(response, signal, CHARACTER_HTTP_LIMITS.candidateJsonBytes)
      )
      assertApiSuccess(response, body, receivedAt, false)
      const parsed = candidatesSchema.safeParse(body)
      if (!parsed.success || parsed.data.rows.some((row) => row.characterName !== nickname)) {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
      signal.throwIfAborted()

      return parsed.data.rows
    } catch (error) {
      transportFailure(error, signal)
    }
  }
}

/** pngjs가 허용하는 중복 IHDR과 상한 없는 인터레이스 압축 해제를 먼저 차단한다. */
function boundPngInflation(bytes: Buffer, width: number, height: number): void {
  const compressed: Buffer[] = []
  let offset = 8
  let headerSeen = false
  let endSeen = false
  while (offset + PNG_CHUNK_OVERHEAD_BYTES <= bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const end = offset + PNG_CHUNK_OVERHEAD_BYTES + length
    if (end > bytes.length) {
      throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
    }
    const type = bytes.toString('ascii', offset + 4, offset + 8)
    if (type === 'IHDR') {
      if (headerSeen) {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
      headerSeen = true
    } else if (type === 'IDAT') {
      compressed.push(bytes.subarray(offset + 8, end - 4))
    } else if (type === 'IEND') {
      endSeen = true
      if (end !== bytes.length) {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
    }
    offset = end
  }
  if (offset !== bytes.length || !endSeen || compressed.length === 0) {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
  // 16비트 RGBA와 Adam7의 일곱 패스를 포함하는 압축 해제 상한이다.
  const maxOutputLength = width * height * PNG_MAX_BYTES_PER_PIXEL + height * PNG_INTERLACE_PASSES
  try {
    inflateSync(Buffer.concat(compressed), { maxOutputLength })
  } catch {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
}

/** pngjs가 RGBA 이미지를 할당하기 전에 크기와 압축 해제 상한을 검증한다. */
function decodeCharacterImage(bytes: Buffer): CharacterImage {
  if (
    bytes.length < PNG_HEADER_BYTES ||
    bytes.subarray(0, 8).toString('hex') !== PNG_SIGNATURE_HEX ||
    bytes.readUInt32BE(8) !== PNG_IHDR_LENGTH ||
    bytes.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  if (
    width < 1 ||
    height < 1 ||
    width > CHARACTER_HTTP_LIMITS.imageDimension ||
    height > CHARACTER_HTTP_LIMITS.imageDimension ||
    width * height > CHARACTER_HTTP_LIMITS.imagePixels
  ) {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
  boundPngInflation(bytes, width, height)
  try {
    const decoded = PNG.sync.read(bytes)
    if (
      decoded.width !== width ||
      decoded.height !== height ||
      decoded.data.length !== width * height * RGBA_CHANNELS
    ) {
      throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
    }
    const rgba = new Uint8Array(decoded.data)

    return { width, height, rgba }
  } catch {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
}

/** 검증한 식별자로 고정 네오플 캐릭터 이미지 경로를 구성해 다운로드한다. */
export function createCharacterImageHttp({
  fetch: transport = fetchApi
}: TransportOptions = {}): CharacterImageHttp {
  const client = createClient(transport)

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
      const bytes = await readBody(response, signal, CHARACTER_HTTP_LIMITS.imageBytes)
      const contentType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
      if (contentType !== 'image/png') {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
      const image = decodeCharacterImage(bytes)
      signal.throwIfAborted()

      return image
    } catch (error) {
      transportFailure(error, signal)
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
  const client = createClient(transport)

  return async ({ serverId, characterId, signal }) => {
    validateIdentity({ serverId, characterId })
    try {
      signal.throwIfAborted()
      const response = await client.get(`${origin}/characters/${serverId}/${characterId}`, {
        headers: { Accept: 'application/json' },
        signal
      })
      const receivedAt = clock?.read().monotonicMs ?? performance.now()
      const body = parseJson(
        await readBody(response, signal, CHARACTER_HTTP_LIMITS.detailJsonBytes)
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
      transportFailure(error, signal)
    }
  }
}

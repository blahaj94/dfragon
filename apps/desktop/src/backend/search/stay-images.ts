import { z } from 'zod'
import { fetchApi } from '../api-fetch'
import type { CharacterIdentity, CharacterImage } from '../../preload/common/types/character'
import type { CharacterAppearanceHttp } from './character-http'
import { CHARACTER_IMAGE_LIMITS, decodeCharacterImage } from './character-image'
import {
  createCharacterHttpClient,
  parseCharacterJson,
  parseCharacterRetryAfter,
  readCharacterResponseBody,
  throwCharacterTransportFailure
} from './character-response'
import { SearchHttpFailure } from './http'

const CATALOG_ORIGIN = 'https://bbscdn.df.nexon.com'
const RENDER_URL = 'https://avatarsync.df.nexon.com/wear/image/stand@1x.png'
const INVALID_CATALOG_INDEX_CHARACTERS = /[^a-zA-Z0-9_-]/
const CATALOG_ICON_PATH_PATTERN = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.png$/
const CATALOG_INDEX_MAX_LENGTH = 256
const CATALOG_JSON_BYTES = 4 * 1024 * 1024
const CATALOG_CACHE_TTL_MS = 30 * 60_000
const RENDER_CACHE_TTL_MS = 5 * 60_000
const CATALOG_CACHE_ENTRIES = 32
const RENDER_CACHE_ENTRIES = 64
const CACHE_MAX_BYTES = 16 * 1024 * 1024
const MAX_STAY_MOTIONS = 4
const STAY_MOTIONS = new Set(['Stay.0', 'Stay.1', 'Stay2.0'])
const HUNTER_GROW_NAMES = new Set(['헌터', '호크 아이', '메이븐', '眞 헌터'])
const ARCHER_JOB = 16
const PREVIEW_GROW = '0'
const HUNTER_PREVIEW_GROW = '3'
const EXCLUDED_FACE_SLOTS = new Set(['AURORA', 'AURA_SKIN'])
const EMPTY_CLONE_DEFAULTS: ReadonlyMap<string, string> = new Map([
  ['HAIR', '레어 머리 클론 아바타'],
  ['WEAPON', '무기 클론 아바타']
])

// 공식 쇼룸의 직업 선택 목록. 표시용 축약명과 달리 API의 jobName을 키로 사용한다.
const SHOWROOM_JOBS: ReadonlyMap<string, number> = new Map([
  ['귀검사(남)', 0],
  ['격투가(여)', 1],
  ['거너(남)', 2],
  ['마법사(여)', 3],
  ['프리스트(남)', 4],
  ['거너(여)', 5],
  ['도적', 6],
  ['격투가(남)', 7],
  ['마법사(남)', 8],
  ['다크나이트', 9],
  ['크리에이터', 10],
  ['귀검사(여)', 11],
  ['나이트', 12],
  ['마창사', 13],
  ['프리스트(여)', 14],
  ['총검사', 15],
  ['아처', 16],
  ['제국기사', 17]
])
const AVATAR_PARTS = {
  HEADGEAR: 'cap',
  HAIR: 'hair',
  FACE: 'face',
  JACKET: 'coat',
  PANTS: 'pants',
  SHOES: 'shoes',
  BREAST: 'neck',
  WAIST: 'belt',
  SKIN: 'skin',
  WEAPON: 'weapon'
} as const
type ShowroomPart = (typeof AVATAR_PARTS)[keyof typeof AVATAR_PARTS]
const nonblank = z.string().refine((value) => value.trim().length > 0)
const iconSchema = z.unknown().transform((value): string | null => {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    !CATALOG_ICON_PATH_PATTERN.test(value)
  ) {
    return null
  }

  return value
})
const catalogSchema = z.array(
  z.object({
    name: nonblank,
    index: z
      .string()
      .min(1)
      .max(CATALOG_INDEX_MAX_LENGTH)
      .refine((value) => !INVALID_CATALOG_INDEX_CHARACTERS.test(value)),
    icon: iconSchema.default(null)
  })
)
const animationSchema = z.object({ job: z.number().int(), animation_list: z.array(nonblank) })
type CatalogRow = z.infer<typeof catalogSchema>[number]
type CatalogValue =
  | { kind: 'avatar'; rows: readonly CatalogRow[] }
  | { kind: 'animation'; motions: readonly string[] }
type CacheEntry<T> = { value: T; bytes: number; expiresAt: number }

/** 완료한 성공값만 공유하므로 서로 다른 호출자의 취소 신호를 묶지 않는다. */
class CompletedCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>()
  private bytes = 0

  constructor(
    private readonly maximumEntries: number,
    private readonly ttlMs: number
  ) {}

  read(key: string): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) {
      return undefined
    }

    if (performance.now() >= entry.expiresAt) {
      this.remove(key, entry)

      return undefined
    }
    this.entries.delete(key)
    this.entries.set(key, entry)

    return entry.value
  }

  write(key: string, value: T, bytes: number): void {
    const now = performance.now()
    for (const [storedKey, entry] of this.entries) {
      if (storedKey === key || now >= entry.expiresAt) {
        this.remove(storedKey, entry)
      }
    }
    if (bytes > CACHE_MAX_BYTES) {
      return
    }
    while (this.entries.size >= this.maximumEntries || this.bytes + bytes > CACHE_MAX_BYTES) {
      const oldest = this.entries.entries().next().value
      if (!oldest) {
        break
      }
      this.remove(oldest[0], oldest[1])
    }
    const expiresAt = now + this.ttlMs
    this.entries.set(key, { value, bytes, expiresAt })
    this.bytes += bytes
  }

  private remove(key: string, entry: CacheEntry<T>): void {
    this.entries.delete(key)
    this.bytes -= entry.bytes
  }
}

type StayResources = {
  catalog: (job: number, part: ShowroomPart, signal: AbortSignal) => Promise<readonly CatalogRow[]>
  motions: (job: number, signal: AbortSignal) => Promise<readonly string[]>
  render: (wearInfo: string, signal: AbortSignal) => Promise<CharacterImage>
}

/** 쇼룸 공개 리소스의 HTTP 실패는 외형 매핑 실패와 구분한다. */
async function requireShowroomSuccess(response: Response): Promise<void> {
  const receivedAt = performance.now()
  if (response.status === 200) {
    return
  }
  await response.body?.cancel().catch(() => undefined)
  if (response.status === 429) {
    const retryAfterSeconds = parseCharacterRetryAfter(response.headers.get('Retry-After'))
    throw new SearchHttpFailure('SEARCH_RATE_LIMITED', {
      retryAfterSeconds,
      retryAfterReceivedAt: receivedAt
    })
  }
  throw new SearchHttpFailure('NEOPLE_API_ERROR')
}

function createStayResources(transport: typeof fetch): StayResources {
  const client = createCharacterHttpClient(transport)
  const catalogs = new CompletedCache<CatalogValue>(CATALOG_CACHE_ENTRIES, CATALOG_CACHE_TTL_MS)
  const renders = new CompletedCache<CharacterImage>(RENDER_CACHE_ENTRIES, RENDER_CACHE_TTL_MS)

  async function readCatalog(
    job: number,
    part: ShowroomPart | 'animation',
    signal: AbortSignal
  ): Promise<CatalogValue> {
    signal.throwIfAborted()
    const key = `${job}_${part}`
    const cached = catalogs.read(key)
    if (cached) {
      return cached
    }
    const response = await client.get(`${CATALOG_ORIGIN}/data7/showroom/static/json/${key}.json`, {
      headers: { Accept: 'application/json' },
      signal
    })
    await requireShowroomSuccess(response)
    const bytes = await readCharacterResponseBody(response, signal, CATALOG_JSON_BYTES)
    const json = parseCharacterJson(bytes)
    let value: CatalogValue
    if (part === 'animation') {
      const parsed = animationSchema.safeParse(json)
      if (!parsed.success || parsed.data.job !== job) {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
      value = { kind: 'animation', motions: parsed.data.animation_list }
    } else {
      const parsed = catalogSchema.safeParse(json)
      if (!parsed.success) {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
      value = { kind: 'avatar', rows: parsed.data }
    }
    signal.throwIfAborted()
    catalogs.write(key, value, bytes.length)

    return value
  }

  return {
    async catalog(job, part, signal) {
      const value = await readCatalog(job, part, signal)
      if (value.kind !== 'avatar') {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }

      return value.rows
    },
    async motions(job, signal) {
      const value = await readCatalog(job, 'animation', signal)
      if (value.kind !== 'animation') {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }

      return value.motions
    },
    async render(wearInfo, signal) {
      signal.throwIfAborted()
      const cached = renders.read(wearInfo)
      if (cached) {
        return cached
      }
      const response = await client.get(RENDER_URL, {
        searchParams: { wearInfo },
        headers: { Accept: 'image/png' },
        signal
      })
      await requireShowroomSuccess(response)
      const bytes = await readCharacterResponseBody(
        response,
        signal,
        CHARACTER_IMAGE_LIMITS.imageBytes
      )
      const contentType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
      if (contentType !== 'image/png') {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
      const image = decodeCharacterImage(bytes)
      signal.throwIfAborted()
      renders.write(wearInfo, image, image.rgba.byteLength)

      return image
    }
  }
}

export type StayImageSourceResult =
  | Readonly<{ kind: 'ready'; images: readonly CharacterImage[] }>
  | Readonly<{
      kind: 'unavailable'
      reason:
        | 'unsupported-job'
        | 'unknown-avatar'
        | 'ambiguous-avatar'
        | 'unknown-clone'
        | 'unsupported-motion'
    }>

export type StayImageSource = (
  input: CharacterIdentity & { signal: AbortSignal }
) => Promise<StayImageSourceResult>

type WearPiece = Readonly<{ index: string; color: 0 }>
type WearInfo = {
  job: string
  grow: string
  level: 0
  hair: WearPiece | null
  cap: WearPiece | null
  face: WearPiece | null
  neck: WearPiece | null
  coat: WearPiece | null
  belt: WearPiece | null
  pants: WearPiece | null
  shoes: WearPiece | null
  skin: WearPiece | null
  weapon1: WearPiece | null
  package: null
}

function avatarPart(slot: string): ShowroomPart | undefined {
  if (Object.hasOwn(AVATAR_PARTS, slot)) {
    return AVATAR_PARTS[slot as keyof typeof AVATAR_PARTS]
  }

  return undefined
}

/** 공식 외형을 쇼룸 Stay로 재구성한다. 복원하지 못한 외형을 불일치로 확정하지 않는다. */
export function createStayImageSource({
  appearance,
  fetch: transport = fetchApi
}: {
  appearance: CharacterAppearanceHttp
  fetch?: typeof fetch
}): StayImageSource {
  const resources = createStayResources(transport)

  return async ({ serverId, characterId, signal }) => {
    try {
      signal.throwIfAborted()
      const value = await appearance({ serverId, characterId, signal })
      signal.throwIfAborted()
      const job = SHOWROOM_JOBS.get(value.jobName)
      if (job === undefined) {
        return { kind: 'unavailable', reason: 'unsupported-job' }
      }
      const grow =
        job === ARCHER_JOB && HUNTER_GROW_NAMES.has(value.jobGrowName)
          ? HUNTER_PREVIEW_GROW
          : PREVIEW_GROW
      const jobId = String(job)
      const wear: WearInfo = {
        job: jobId,
        grow,
        level: 0,
        hair: null,
        cap: null,
        face: null,
        neck: null,
        coat: null,
        belt: null,
        pants: null,
        shoes: null,
        skin: null,
        weapon1: null,
        package: null
      }
      const seen = new Set<string>()
      for (const avatar of value.avatar) {
        signal.throwIfAborted()
        if (EXCLUDED_FACE_SLOTS.has(avatar.slotId)) {
          continue
        }
        const part = avatarPart(avatar.slotId)
        if (!part || seen.has(part)) {
          return { kind: 'unavailable', reason: 'unknown-avatar' }
        }
        seen.add(part)
        const hasCloneId = avatar.clone.itemId !== null
        const hasCloneName = avatar.clone.itemName !== null
        if (hasCloneId !== hasCloneName) {
          return { kind: 'unavailable', reason: 'unknown-clone' }
        }
        const name = avatar.clone.itemName ?? avatar.itemName
        const rows = await resources.catalog(job, part, signal)
        const matches = rows.filter((row) => row.name.trim() === name.trim())
        if (matches.length === 0) {
          const emptyCloneDefault =
            !hasCloneId && EMPTY_CLONE_DEFAULTS.get(avatar.slotId) === avatar.itemName
          if (emptyCloneDefault) {
            continue
          }

          return { kind: 'unavailable', reason: 'unknown-avatar' }
        }
        const icon = matches[0].icon
        if (icon === null || matches.some((row) => row.icon !== icon)) {
          return { kind: 'unavailable', reason: 'ambiguous-avatar' }
        }
        const targetPart = part === 'weapon' ? 'weapon1' : part
        const index = matches[0].index
        // 기본색은 윤곽 비교용이며 실제 염색을 복원한 값이 아니다.
        wear[targetPart] = { index, color: 0 }
      }
      const motions = await resources.motions(job, signal)
      const idle = [...new Set(motions.filter((motion) => motion.startsWith('Stay')))]
      if (
        idle.length === 0 ||
        idle.length > MAX_STAY_MOTIONS ||
        idle.some((motion) => !STAY_MOTIONS.has(motion))
      ) {
        return { kind: 'unavailable', reason: 'unsupported-motion' }
      }
      const images: CharacterImage[] = []
      for (const animation of idle) {
        signal.throwIfAborted()
        const wearInfo = JSON.stringify({ ...wear, animation })
        images.push(await resources.render(wearInfo, signal))
      }
      signal.throwIfAborted()

      return { kind: 'ready', images }
    } catch (error) {
      throwCharacterTransportFailure(error, signal)
    }
  }
}

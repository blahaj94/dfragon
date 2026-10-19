import type { CharacterCard } from './types/character'
import type { CharacterDetailSnapshot } from './types/character-detail'

// 제한된 preload는 일반 앱 preload의 runtime 모듈을 공유하지 않는다. 두 preload가 같은 모듈을 쓰면 공유
// chunk가 생겨 sandbox preload가 불러오지 못하므로, 카드 값 검사도 일반 preload의 zod 스키마
// (`characterCardSchema`)와 같은 규칙을 여기에 따로 둔다.
const DETAIL_SERVER_NAMES: Readonly<Record<string, string>> = {
  anton: '안톤',
  bakal: '바칼',
  cain: '카인',
  casillas: '카시야스',
  diregie: '디레지에',
  hilder: '힐더',
  prey: '프레이',
  siroco: '시로코'
}
const CHARACTER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,256}$/
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z$/
const OFFSET_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/
const DETAIL_CHARACTER_KEYS = [
  'serverId',
  'characterId',
  'characterName',
  'serverName',
  'adventureName',
  'jobName',
  'jobGrowName',
  'level',
  'fame',
  'imageUrl',
  'guildName'
] as const

type Check = (value: unknown) => boolean

function hasKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  return (
    Reflect.ownKeys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
  )
}

function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value)
}

function isNonblank(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function isCount(value: unknown): boolean {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isPositiveInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && (value as number) > 0
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !UTC_TIMESTAMP_PATTERN.test(value)) {
    return false
  }
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) {
    return false
  }

  const secondsBoundary = value[16] === ':' ? 19 : 16

  return parsed.toISOString().slice(0, secondsBoundary) === value.slice(0, secondsBoundary)
}

function isOffsetTimestamp(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    OFFSET_TIMESTAMP_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}

// 아래 조합은 카드 값 검사에만 쓴다. 객체는 정한 키만 가져야 하고 배열은 모든 항목이 맞아야 한다.
const nullable =
  (check: Check): Check =>
  (value) =>
    value === null || check(value)
const oneOf =
  (...values: readonly unknown[]): Check =>
  (value) =>
    values.includes(value)
const list =
  (check: Check): Check =>
  (value) =>
    Array.isArray(value) && value.every(check)
const strict =
  (shape: Readonly<Record<string, Check>>): Check =>
  (value) =>
    hasKeys(value, Object.keys(shape)) &&
    Object.entries(shape).every(([key, check]) => check(value[key]))

const point = strict({ current: isNumber, min: isNumber, max: isNumber })
const rarityCount = strict({ rarity: isNonblank, count: isCount })
const dealerStats = strict({
  role: oneOf('dealer'),
  attackIncrease: isNullableNumber,
  amplification: isNullableNumber,
  critical: isNullableNumber,
  switchingLevel: isNullableNumber
})
const bufferStats = strict({
  role: oneOf('buffer'),
  townIntelligence: isNullableNumber,
  buff30: isNullableNumber,
  buff50: isNullableNumber,
  switchingLevel: isNullableNumber
})
const investment = strict({
  slotId: isNonblank,
  slotName: isNonblank,
  itemId: nullable(isNonblank),
  itemName: nullable(isNonblank),
  rarity: nullable(isNonblank),
  reinforce: nullable(
    strict({
      kind: oneOf('reinforce', 'amplify'),
      value: isCount,
      amplificationName: nullable(isNonblank)
    })
  ),
  enchant: nullable(
    strict({
      status: list(
        strict({
          name: isNonblank,
          value: (value) => isNumber(value) || isNonblank(value)
        })
      ),
      grade: nullable(oneOf('종결', '준종결', '기타'))
    })
  )
})
const characterCard = strict({
  role: nullable(oneOf('dealer', 'buffer')),
  stats: nullable((value) => dealerStats(value) || bufferStats(value)),
  score: nullable(
    strict({
      calculator: oneOf('equipment', 'buff'),
      value: isNullableNumber,
      skipped: nullable(strict({ kind: isNonblank, message: isNonblank })),
      versions: strict({ package: isNonblank, rulesRev: isNonblank, bundleId: isNonblank })
    })
  ),
  serverRank: nullable(
    strict({
      rank: isPositiveInteger,
      total: isPositiveInteger,
      basis: oneOf('fame'),
      scope: oneOf('stored'),
      observedAt: isOffsetTimestamp
    })
  ),
  set: nullable(
    strict({
      setItemId: isNonblank,
      name: isNonblank,
      rarityName: nullable(isNonblank),
      point: nullable(point),
      imageItemId: nullable(isNonblank),
      slots: list(strict({ slotId: isNonblank, rarity: nullable(isNonblank) })),
      rarityCounts: list(rarityCount)
    })
  ),
  oath: nullable(
    strict({
      itemId: isNonblank,
      name: isNonblank,
      rarity: nullable(isNonblank),
      point: isNullableNumber,
      setName: nullable(isNonblank),
      optionName: nullable(isNonblank),
      setPoint: nullable(point),
      upgrades: list(
        strict({ step: isPositiveInteger, stepName: isNonblank, optionName: isNonblank })
      ),
      crystals: list(
        strict({
          slotNo: isCount,
          itemId: isNonblank,
          name: isNonblank,
          rarity: nullable(isNonblank),
          setPoint: isNullableNumber
        })
      ),
      rarityCounts: list(rarityCount)
    })
  ),
  investment: list(investment)
})

/** 상세 창에 넘길 카드 값이 메인 카드의 카드 값과 같은 모양인지 확인한다. 숫자는 유한값만 받는다. */
export function isCharacterDetailCard(value: unknown): value is CharacterCard {
  return characterCard(value)
}

export function parseCharacterDetailSnapshot(value: unknown): CharacterDetailSnapshot {
  if (!hasKeys(value, ['character', 'card', 'freshness'])) {
    throw new Error('CHARACTER_DETAIL_UNAVAILABLE')
  }
  const { character, card, freshness } = value
  if (
    !hasKeys(character, DETAIL_CHARACTER_KEYS) ||
    !hasKeys(freshness, ['lastSuccessfulFetchAt', 'expiresAt']) ||
    (card !== null && !isCharacterDetailCard(card))
  ) {
    throw new Error('CHARACTER_DETAIL_UNAVAILABLE')
  }
  const {
    serverId,
    characterId,
    characterName,
    serverName,
    adventureName,
    jobName,
    jobGrowName,
    level,
    fame,
    imageUrl,
    guildName
  } = character
  const { lastSuccessfulFetchAt, expiresAt } = freshness
  if (
    typeof serverId !== 'string' ||
    !Object.hasOwn(DETAIL_SERVER_NAMES, serverId) ||
    typeof characterId !== 'string' ||
    !CHARACTER_ID_PATTERN.test(characterId) ||
    typeof characterName !== 'string' ||
    characterName.trim().length === 0 ||
    typeof serverName !== 'string' ||
    serverName !== DETAIL_SERVER_NAMES[serverId] ||
    !isNullableText(adventureName) ||
    !isNullableText(jobName) ||
    !isNullableText(jobGrowName) ||
    !isNullableNumber(level) ||
    !isNullableNumber(fame) ||
    typeof imageUrl !== 'string' ||
    imageUrl !==
      `https://img-api.neople.co.kr/df/servers/${serverId}/characters/${characterId}?zoom=1` ||
    !isNullableText(guildName) ||
    !isTimestamp(lastSuccessfulFetchAt) ||
    !isTimestamp(expiresAt)
  ) {
    throw new Error('CHARACTER_DETAIL_UNAVAILABLE')
  }
  const parsedCharacter = {
    serverId,
    characterId,
    characterName,
    serverName,
    adventureName,
    jobName,
    jobGrowName,
    level,
    fame,
    imageUrl,
    guildName
  }
  const parsedCard = card === null ? null : structuredClone(card)
  const parsedFreshness = { lastSuccessfulFetchAt, expiresAt }

  return { character: parsedCharacter, card: parsedCard, freshness: parsedFreshness }
}

import type { CharacterDetailSnapshot } from './types/character-detail'

// 제한된 preload는 일반 앱 preload의 runtime 모듈을 공유하지 않는다.
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
  'imageUrl'
] as const

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

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
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

export function parseCharacterDetailSnapshot(value: unknown): CharacterDetailSnapshot {
  if (!hasKeys(value, ['character', 'freshness'])) {
    throw new Error('CHARACTER_DETAIL_UNAVAILABLE')
  }
  const { character, freshness } = value
  if (
    !hasKeys(character, DETAIL_CHARACTER_KEYS) ||
    !hasKeys(freshness, ['lastSuccessfulFetchAt', 'expiresAt'])
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
    imageUrl
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
    imageUrl
  }
  const parsedFreshness = { lastSuccessfulFetchAt, expiresAt }

  return { character: parsedCharacter, freshness: parsedFreshness }
}

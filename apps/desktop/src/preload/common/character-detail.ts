import {
  exactObject,
  hasExactKeys,
  isFiniteNumber,
  isNonblankString,
  isNonNegativeSafeInteger,
  isNullableFiniteNumber,
  isNullableString,
  isOffsetTimestamp,
  isPositiveSafeInteger,
  isRecord,
  isUtcTimestamp,
  listOf,
  nullable,
  oneOf
} from '@dfragon/lib/utils/shape-check'
import type { CharacterCard } from './types/character'
import type {
  CharacterDetailItemTexts,
  CharacterDetailSkill,
  CharacterDetailSkills,
  CharacterDetailSnapshot
} from './types/character-detail'

// 제한된 preload는 일반 앱 preload의 runtime 모듈을 공유하지 않는다. 두 preload가 같은 모듈을 쓰면 공유
// chunk가 생겨 sandbox preload가 불러오지 못하므로, 카드 값 검사도 일반 preload의 zod 스키마
// (`characterCardSchema`)와 같은 규칙을 일반 preload가 쓰지 않는 `@dfragon/lib/utils/shape-check` 검사로
// 여기에 따로 둔다.
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
// API가 아이템 상세를 붙이는 itemId 규칙(catalog id)과 같다.
const ITEM_ID_PATTERN = /^[a-zA-Z0-9_-]{1,256}$/
// 장비 12부위, 서약 본체 하나, 결정 0~10번 11칸이다.
const DETAIL_ITEM_TEXT_MAX_ITEMS = 24
/** 설명 상자 문구 하나의 최대 길이. main은 이보다 긴 원문을 넘기지 않는다. */
export const CHARACTER_DETAIL_ITEM_TEXT_MAX_LENGTH = 2000
// 한 직업의 습득, 패시브 스킬은 100개를 넘지 않는다. 직업 개편으로 늘어날 여유를 두고 200개까지만 받는다.
const DETAIL_SKILL_MAX_COUNT = 200
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

const point = exactObject({ current: isFiniteNumber, min: isFiniteNumber, max: isFiniteNumber })
const rarityCount = exactObject({ rarity: isNonblankString, count: isNonNegativeSafeInteger })
const dealerStats = exactObject({
  role: oneOf('dealer'),
  attackIncrease: isNullableFiniteNumber,
  amplification: isNullableFiniteNumber,
  critical: isNullableFiniteNumber,
  switchingLevel: isNullableFiniteNumber
})
const bufferStats = exactObject({
  role: oneOf('buffer'),
  townStatName: oneOf('지능', '정신력', '체력'),
  townStat: isNullableFiniteNumber,
  buff30: isNullableFiniteNumber,
  buff50: isNullableFiniteNumber,
  switchingLevel: isNullableFiniteNumber
})
const investment = exactObject({
  slotId: isNonblankString,
  slotName: isNonblankString,
  itemId: nullable(isNonblankString),
  itemName: nullable(isNonblankString),
  rarity: nullable(isNonblankString),
  exclusive: oneOf(true, false),
  reinforce: nullable(
    exactObject({
      kind: oneOf('reinforce', 'amplify'),
      value: isNonNegativeSafeInteger,
      amplificationName: nullable(isNonblankString)
    })
  ),
  enchant: nullable(
    exactObject({
      status: listOf(
        exactObject({
          name: isNonblankString,
          value: (value) => isFiniteNumber(value) || isNonblankString(value)
        })
      ),
      grade: nullable(oneOf('종결', '준종결', '기타'))
    })
  )
})
const characterCard = exactObject({
  role: nullable(oneOf('dealer', 'buffer')),
  stats: nullable((value) => dealerStats(value) || bufferStats(value)),
  score: nullable(
    exactObject({
      calculator: oneOf('equipment', 'buff'),
      value: isNullableFiniteNumber,
      skipped: nullable(exactObject({ kind: isNonblankString, message: isNonblankString })),
      versions: exactObject({
        package: isNonblankString,
        rulesRev: isNonblankString,
        bundleId: isNonblankString
      })
    })
  ),
  serverRank: nullable(
    exactObject({
      rank: isPositiveSafeInteger,
      total: isPositiveSafeInteger,
      basis: oneOf('fame'),
      scope: oneOf('stored'),
      observedAt: isOffsetTimestamp
    })
  ),
  set: nullable(
    exactObject({
      setItemId: isNonblankString,
      name: isNonblankString,
      rarityName: nullable(isNonblankString),
      point: nullable(point),
      imageItemId: nullable(isNonblankString),
      slots: listOf(
        exactObject({
          slotId: isNonblankString,
          rarity: nullable(isNonblankString),
          exclusive: oneOf(true, false)
        })
      ),
      rarityCounts: listOf(rarityCount)
    })
  ),
  oath: nullable(
    exactObject({
      itemId: isNonblankString,
      name: isNonblankString,
      rarity: nullable(isNonblankString),
      point: isNullableFiniteNumber,
      setName: nullable(isNonblankString),
      optionName: nullable(isNonblankString),
      setPoint: nullable(point),
      upgrades: listOf(
        exactObject({
          step: isPositiveSafeInteger,
          stepName: isNonblankString,
          optionName: isNonblankString
        })
      ),
      crystals: listOf(
        exactObject({
          slotNo: isNonNegativeSafeInteger,
          itemId: isNonblankString,
          name: isNonblankString,
          rarity: nullable(isNonblankString),
          setPoint: isNullableFiniteNumber
        })
      ),
      rarityCounts: listOf(rarityCount)
    })
  ),
  investment: listOf(investment)
})

function isItemTextValue(value: unknown): boolean {
  return isNonblankString(value) && value.length <= CHARACTER_DETAIL_ITEM_TEXT_MAX_LENGTH
}

const itemText = exactObject({
  explain: nullable(isItemTextValue),
  buff: nullable(isItemTextValue),
  flavor: nullable(isItemTextValue)
})

const detailSkill = exactObject({
  name: isNonblankString,
  level: isNonNegativeSafeInteger,
  description: nullable(isItemTextValue),
  coolTime: nullable((value) => isFiniteNumber(value) && value >= 0),
  vpNames: listOf(isNonblankString),
  vpName: nullable(isNonblankString)
})

// 고른 VP는 그 스킬의 VP 이름 중 하나다.
function isDetailSkill(value: unknown): value is CharacterDetailSkill {
  if (!detailSkill(value) || !isRecord(value)) {
    return false
  }
  const { vpNames, vpName } = value

  return vpName === null || (Array.isArray(vpNames) && vpNames.includes(vpName))
}

/** 스킬 탭에 스킬을 둘 수 있는 jobId, jobGrowId, skillId인지 확인한다. API catalog id 규칙과 같다. */
export function isCharacterDetailSkillId(value: unknown): value is string {
  return typeof value === 'string' && ITEM_ID_PATTERN.test(value)
}

function isDetailSkills(value: unknown): value is CharacterDetailSkills {
  if (!hasExactKeys(value, ['jobId', 'jobGrowId', 'learned'])) {
    return false
  }
  const { jobId, jobGrowId, learned } = value
  if (
    !isCharacterDetailSkillId(jobId) ||
    !isCharacterDetailSkillId(jobGrowId) ||
    !isRecord(learned)
  ) {
    return false
  }
  const keys = Reflect.ownKeys(learned)

  return (
    keys.length <= DETAIL_SKILL_MAX_COUNT &&
    keys.every((key) => isCharacterDetailSkillId(key) && isDetailSkill(learned[key]))
  )
}

/** 설명 상자 문구를 둘 수 있는 itemId인지 확인한다. */
export function isCharacterDetailItemId(value: unknown): value is string {
  return typeof value === 'string' && ITEM_ID_PATTERN.test(value)
}

function isItemTexts(value: unknown): value is CharacterDetailItemTexts {
  if (!isRecord(value)) {
    return false
  }
  const keys = Reflect.ownKeys(value)

  return (
    keys.length <= DETAIL_ITEM_TEXT_MAX_ITEMS &&
    keys.every((key) => isCharacterDetailItemId(key) && itemText(value[key]))
  )
}

/** 상세 창에 넘길 카드 값이 메인 카드의 카드 값과 같은 모양인지 확인한다. 숫자는 유한값만 받는다. */
export function isCharacterDetailCard(value: unknown): value is CharacterCard {
  return characterCard(value)
}

export function parseCharacterDetailSnapshot(value: unknown): CharacterDetailSnapshot {
  if (!hasExactKeys(value, ['character', 'card', 'itemTexts', 'skills', 'freshness'])) {
    throw new Error('CHARACTER_DETAIL_UNAVAILABLE')
  }
  const { character, card, itemTexts, skills, freshness } = value
  if (
    !hasExactKeys(character, DETAIL_CHARACTER_KEYS) ||
    !hasExactKeys(freshness, ['lastSuccessfulFetchAt', 'expiresAt']) ||
    (card !== null && !isCharacterDetailCard(card)) ||
    !isItemTexts(itemTexts) ||
    (skills !== null && !isDetailSkills(skills))
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
    !isNullableString(adventureName) ||
    !isNullableString(jobName) ||
    !isNullableString(jobGrowName) ||
    !isNullableFiniteNumber(level) ||
    !isNullableFiniteNumber(fame) ||
    typeof imageUrl !== 'string' ||
    imageUrl !==
      `https://img-api.neople.co.kr/df/servers/${serverId}/characters/${characterId}?zoom=1` ||
    !isNullableString(guildName) ||
    !isUtcTimestamp(lastSuccessfulFetchAt) ||
    !isUtcTimestamp(expiresAt)
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
  const parsedItemTexts = structuredClone(itemTexts)
  const parsedSkills = skills === null ? null : structuredClone(skills)
  const parsedFreshness = { lastSuccessfulFetchAt, expiresAt }

  return {
    character: parsedCharacter,
    card: parsedCard,
    itemTexts: parsedItemTexts,
    skills: parsedSkills,
    freshness: parsedFreshness
  }
}

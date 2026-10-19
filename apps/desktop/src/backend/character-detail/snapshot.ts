import {
  isFiniteNumber,
  isNonblankString,
  isNonNegativeSafeInteger,
  isRecord,
  oneOf
} from '@dfragon/lib/utils/shape-check'
import type {
  CharacterCard,
  CharacterDetails,
  CharacterJsonValue
} from '../../preload/common/types/character'
import { characterImageUrl } from '../../preload/common/search/character-summary'
import {
  CHARACTER_DETAIL_ITEM_TEXT_MAX_LENGTH,
  isCharacterDetailItemId,
  isCharacterDetailSkillId,
  parseCharacterDetailSnapshot
} from '../../preload/common/character-detail'
import type {
  CharacterDetailItemText,
  CharacterDetailSkill,
  CharacterDetailSkills,
  CharacterDetailSnapshot
} from '../../preload/common/types/character-detail'

// 상세 창 장비 목록의 12부위(칭호 제외)와 서약 결정 자리 0~10번. renderer의 `investmentIds`,
// `crystalSlotGroups`와 같다.
const DETAIL_EQUIPMENT_SLOT_IDS = [
  'WEAPON',
  'JACKET',
  'SHOULDER',
  'PANTS',
  'WAIST',
  'SHOES',
  'AMULET',
  'WRIST',
  'RING',
  'SUPPORT',
  'MAGIC_STON',
  'EARRING'
]
const DETAIL_CRYSTAL_SLOT_COUNT = 11
// API 아이템 상세의 상태 중 원문을 쓸 수 있는 값. unavailable이면 data가 없다.
const isUsableItemDetailStatus = oneOf('fresh', 'stale')

function optionalText(value: CharacterJsonValue | undefined): string | null {
  if (typeof value === 'string') {
    return value
  }

  return null
}

function optionalNumber(value: CharacterJsonValue | undefined): number | null {
  if (isFiniteNumber(value)) {
    return value
  }

  return null
}

function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRecord)
}

// 설명 상자 문구는 원문 그대로 둔다. 비었거나 상세 창이 받는 길이를 넘으면 없는 값이다.
function itemTextValue(value: unknown): string | null {
  if (!isNonblankString(value) || value.length > CHARACTER_DETAIL_ITEM_TEXT_MAX_LENGTH) {
    return null
  }

  return value
}

// 아이템 상세가 같은 itemId의 원문이고 쓸 수 있는 상태일 때만 설명, 버프 스킬, 플레이버 문구를 고른다.
function readItemText(
  item: Record<string, unknown> | undefined
): readonly [string, CharacterDetailItemText] | null {
  if (item === undefined || !isCharacterDetailItemId(item.itemId)) {
    return null
  }
  const { itemId, itemDetail } = item
  if (!isRecord(itemDetail) || !isUsableItemDetailStatus(itemDetail.status)) {
    return null
  }
  const { data } = itemDetail
  if (!isRecord(data) || data.itemId !== itemId) {
    return null
  }
  const buff = isRecord(data.itemBuff) ? data.itemBuff.explain : undefined
  const text = {
    explain: itemTextValue(data.itemExplain),
    buff: itemTextValue(buff),
    flavor: itemTextValue(data.itemFlavorText)
  }

  return [itemId, text]
}

// 상세 창 장비 목록에 보이는 아이템만 고른다. 부위와 결정 자리마다 첫 장착 항목 하나다.
function collectItemTexts(details: CharacterDetails): Record<string, CharacterDetailItemText> {
  const equipment = records(details.equipment.equipment)
  const oath = isRecord(details.oath) ? details.oath : null
  const crystals = records(oath?.crystal)
  const items = [
    ...DETAIL_EQUIPMENT_SLOT_IDS.map((slotId) => equipment.find((item) => item.slotId === slotId)),
    isRecord(oath?.info) ? oath.info : undefined,
    ...Array.from({ length: DETAIL_CRYSTAL_SLOT_COUNT }, (_, slotNo) =>
      crystals.find((crystal) => crystal.slotNo === slotNo)
    )
  ]
  const entries = items.flatMap((item) => {
    const entry = readItemText(item)
    if (entry === null) {
      return []
    }

    return [entry]
  })

  return Object.fromEntries(entries)
}

// 공용 상세(`itemDetail`, `skillDetails[id]`)가 원문을 쓸 수 있는 상태면 그 data를 고른다.
function usableDetailData(detail: unknown): Record<string, unknown> | null {
  if (!isRecord(detail) || !isUsableItemDetailStatus(detail.status) || !isRecord(detail.data)) {
    return null
  }

  return detail.data
}

// 현재 레벨 줄의 쿨타임(초). 레벨 줄이 없거나 쿨타임이 음수, 숫자가 아니면 없는 값이다.
function coolTimeAt(data: Record<string, unknown> | null, level: number): number | null {
  const levelInfo = isRecord(data?.levelInfo) ? data.levelInfo : null
  const row = records(levelInfo?.rows).find((entry) => entry.level === level)
  const coolTime = row?.coolTime
  if (!isFiniteNumber(coolTime) || coolTime < 0) {
    return null
  }

  return coolTime
}

// 상세 evolution 항목의 VP 이름을 type 순서로 고른다. 이름이 비었거나 type이 숫자가 아닌 항목은 뺀다.
function vpEntries(data: Record<string, unknown> | null): (readonly [number, string])[] {
  const entries = records(data?.evolution).flatMap((entry) => {
    if (!isFiniteNumber(entry.type) || !isNonblankString(entry.name)) {
      return []
    }

    return [[entry.type, entry.name] as const]
  })

  return entries.toSorted(([a], [b]) => a - b)
}

// 스킬 탭에 넘길 습득, 패시브 스킬. 이름이나 레벨이 틀린 항목은 빼고, 같은 skillId는 처음 항목을 쓴다.
function collectSkills(details: CharacterDetails): CharacterDetailSkills | null {
  const { jobId, jobGrowId } = details.character
  const skillStyle = isRecord(details.skillStyle) ? details.skillStyle : null
  const style = isRecord(skillStyle?.style) ? skillStyle.style : null
  if (!isCharacterDetailSkillId(jobId) || !isCharacterDetailSkillId(jobGrowId) || style === null) {
    return null
  }
  const skillDetails = isRecord(skillStyle?.skillDetails) ? skillStyle.skillDetails : {}
  const vpTypes = new Map(records(style.evolution).map((entry) => [entry.skillId, entry.type]))
  const learned = new Map<string, CharacterDetailSkill>()
  for (const entry of [...records(style.active), ...records(style.passive)]) {
    const { skillId, name, level } = entry
    if (
      !isCharacterDetailSkillId(skillId) ||
      learned.has(skillId) ||
      !isNonblankString(name) ||
      !isNonNegativeSafeInteger(level)
    ) {
      continue
    }
    const data = usableDetailData(skillDetails[skillId])
    const vps = vpEntries(data)
    const vpType = vpTypes.get(skillId)
    const selectedVp = vps.find(([type]) => type === vpType)
    const skill = {
      name,
      level,
      description: itemTextValue(data?.desc),
      coolTime: coolTimeAt(data, level),
      vpNames: vps.map(([, vpName]) => vpName),
      vpName: selectedVp === undefined ? null : selectedVp[1]
    }
    learned.set(skillId, skill)
  }
  const learnedById = Object.fromEntries(learned)

  return { jobId, jobGrowId, learned: learnedById }
}

/**
 * 상세 창에 넘길 값을 만든다. 기본 정보는 상세 응답에서, 카드 값은 검색이 메인 카드에 넘긴 값(점수 포함)을
 * 그대로 쓰고 점수를 다시 계산하지 않는다. 설명 상자 문구는 상세 응답의 아이템 상세에서, 스킬 탭 값은 스킬
 * 스타일과 스킬 공용 상세에서 고른다.
 */
export function createCharacterDetailSnapshot(
  details: CharacterDetails,
  card: CharacterCard | null
): CharacterDetailSnapshot {
  const source = details.character
  const adventureName = optionalText(source.adventureName)
  const jobName = optionalText(source.jobName)
  const jobGrowName = optionalText(source.jobGrowName)
  const level = optionalNumber(source.level)
  const fame = optionalNumber(source.fame)
  const guildName = optionalText(source.guildName)
  const imageUrl = characterImageUrl(source)
  const character = {
    serverId: source.serverId,
    characterId: source.characterId,
    characterName: source.characterName,
    serverName: source.serverName,
    adventureName,
    jobName,
    jobGrowName,
    level,
    fame,
    imageUrl,
    guildName
  }
  const itemTexts = collectItemTexts(details)
  const skills = collectSkills(details)
  const freshness = { ...details.freshness }

  return parseCharacterDetailSnapshot({ character, card, itemTexts, skills, freshness })
}

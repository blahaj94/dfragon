import { isFiniteNumber, isNonblankString, isRecord, oneOf } from '@dfragon/lib/utils/shape-check'
import type {
  CharacterCard,
  CharacterDetails,
  CharacterJsonValue
} from '../../preload/common/types/character'
import { characterImageUrl } from '../../preload/common/search/character-summary'
import {
  CHARACTER_DETAIL_ITEM_TEXT_MAX_LENGTH,
  isCharacterDetailItemId,
  parseCharacterDetailSnapshot
} from '../../preload/common/character-detail'
import type {
  CharacterDetailItemText,
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

/**
 * 상세 창에 넘길 값을 만든다. 기본 정보는 상세 응답에서, 카드 값은 검색이 메인 카드에 넘긴 값(점수 포함)을
 * 그대로 쓰고 점수를 다시 계산하지 않는다. 설명 상자 문구는 상세 응답의 아이템 상세에서 고른다.
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
  const freshness = { ...details.freshness }

  return parseCharacterDetailSnapshot({ character, card, itemTexts, freshness })
}

import type { CharacterDetails, CharacterJsonValue } from '../../preload/common/types/character'

type JsonObject = { readonly [key: string]: CharacterJsonValue }

/** 점수 엔진 입력 문서(`dnf-character-v1`). 각 문서는 Neople 응답 원문 형태다. */
export type ScoreEngineInput = Readonly<{
  status: JsonObject
  equipment: JsonObject
  avatar: JsonObject
  creature: JsonObject
  oath: JsonObject
  mist_assimilation: JsonObject
  skill_style: JsonObject
  buff_equip_equipment: JsonObject
  buff_equip_avatar: JsonObject
  buff_equip_creature: JsonObject
  items: Readonly<Record<string, JsonObject>>
}>

// API는 basic 응답의 머리만 character로 남기므로 모든 문서의 머리를 이 값으로 복원한다.
const RESPONSE_HEADER_FIELDS = [
  'serverId',
  'characterId',
  'characterName',
  'level',
  'jobId',
  'jobGrowId',
  'jobName',
  'jobGrowName',
  'fame',
  'adventureName',
  'guildId',
  'guildName'
] as const
// 서버가 응답용으로 예약해 더한 필드다. Neople 원문에는 없으므로 엔진 입력에서 뺀다.
const ITEM_DETAIL_FIELD = 'itemDetail'
const SKILL_DETAILS_FIELD = 'skillDetails'

export function isJsonObject(value: CharacterJsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 아이템 상세가 같은 itemId의 Neople 아이템 응답일 때만 엔진의 items에 둔다. */
function readItemDetail(item: JsonObject): JsonObject | null {
  const itemId = item.itemId
  const detail = item[ITEM_DETAIL_FIELD]
  if (typeof itemId !== 'string' || !isJsonObject(detail)) {
    return null
  }
  const data = detail.data
  if (!isJsonObject(data) || data.itemId !== itemId) {
    return null
  }

  return data
}

function restoreOriginal(
  value: CharacterJsonValue,
  items: Record<string, JsonObject>
): CharacterJsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => restoreOriginal(entry, items))
  }

  if (!isJsonObject(value)) {
    return value
  }
  const data = readItemDetail(value)
  if (data !== null) {
    items[value.itemId as string] = data
  }
  const entries = Object.entries(value)
    .filter(([key]) => key !== ITEM_DETAIL_FIELD)
    .map(([key, entry]) => [key, restoreOriginal(entry, items)] as const)

  return Object.fromEntries(entries)
}

function withoutSkillDetails(value: CharacterJsonValue): CharacterJsonValue {
  if (!isJsonObject(value)) {
    return value
  }
  const { [SKILL_DETAILS_FIELD]: _skillDetails, ...skill } = value

  return skill
}

/**
 * 상세 응답의 basic을 뺀 10개 섹션과 아이템 상세를 엔진 입력 문서로 바꾼다. 서버가 더한 필드는 넣지 않고
 * 아이템 상세는 `items[itemId]`로 옮긴다.
 */
export function toScoreEngineInput(details: CharacterDetails): ScoreEngineInput {
  const items: Record<string, JsonObject> = {}
  const original = (value: CharacterJsonValue): CharacterJsonValue => restoreOriginal(value, items)
  const header = Object.fromEntries(
    RESPONSE_HEADER_FIELDS.map((field) => [field, details.character[field] ?? null])
  )
  const document = (body: JsonObject): JsonObject => ({ ...header, ...body })
  const buff = (value: CharacterJsonValue): JsonObject =>
    document({ skill: { buff: original(value) } })

  return {
    status: document({
      status: original(details.status.status),
      buff: original(details.status.buff)
    }),
    equipment: document({
      equipment: original(details.equipment.equipment),
      setItemInfo: original(details.equipment.setItemInfo)
    }),
    avatar: document({ avatar: original(details.avatar) }),
    creature: document({ creature: original(details.creature) }),
    oath: document({ oath: original(details.oath) }),
    mist_assimilation: document({ mistAssimilation: original(details.mistAssimilation) }),
    skill_style: document({ skill: withoutSkillDetails(original(details.skillStyle)) }),
    buff_equip_equipment: buff(details.buff.equipment),
    buff_equip_avatar: buff(details.buff.avatar),
    buff_equip_creature: buff(details.buff.creature),
    items
  }
}

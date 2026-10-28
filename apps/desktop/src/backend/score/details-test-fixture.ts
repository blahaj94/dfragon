import { readFileSync } from 'node:fs'
import type {
  CharacterCard,
  CharacterDetails,
  CharacterJsonValue
} from '../../preload/common/types/character'
import type { ScoreEngineInput } from './input'

type JsonObject = { readonly [key: string]: CharacterJsonValue }

/**
 * 비공개 엔진 저장소의 golden 벡터 입력(가명 처리한 딜러 1명, 버퍼 1명)이다. API 1번 항목의 실응답 모양
 * fixture가 들어오면 그 상세 응답으로 바꾼다.
 */
export function readEngineInput(name: 'dealer-blade' | 'buffer-muse'): ScoreEngineInput {
  const url = new URL(`./fixtures/${name}.engine-input.json`, import.meta.url)

  return JSON.parse(readFileSync(url, 'utf8')) as ScoreEngineInput
}

const CATALOG_ID_PATTERN = /^[0-9a-f]{32}$/
const FETCHED_AT = '2026-10-19T00:00:00.000Z'

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function apiDetailsFromEngineInput(
  input: ScoreEngineInput,
  card: CharacterCard | null
): CharacterDetails {
  const { items } = input
  const attach = (value: CharacterJsonValue): CharacterJsonValue => {
    if (!isJsonObject(value) || typeof value.itemId !== 'string') {
      return value
    }

    if (!CATALOG_ID_PATTERN.test(value.itemId)) {
      return value
    }
    const data = items[value.itemId] ?? null
    const status = data === null ? 'unavailable' : 'fresh'

    return { ...value, itemDetail: { data, fetchedAt: FETCHED_AT, status } }
  }
  const list = (
    value: CharacterJsonValue,
    map: (entry: CharacterJsonValue) => CharacterJsonValue
  ) => (Array.isArray(value) ? value.map(map) : value)
  const item = (value: CharacterJsonValue): CharacterJsonValue => {
    if (!isJsonObject(value)) {
      return value
    }
    const result: Record<string, CharacterJsonValue> = { ...(attach(value) as JsonObject) }
    if (Object.hasOwn(value, 'clone')) {
      result.clone = attach(value.clone)
    }

    if (Object.hasOwn(value, 'emblems')) {
      result.emblems = list(value.emblems, attach)
    }

    if (Object.hasOwn(value, 'artifact')) {
      result.artifact = list(value.artifact, attach)
    }

    return result
  }
  const buff = (section: JsonObject, key: string): CharacterJsonValue => {
    const skill = section.skill
    const value = isJsonObject(skill) ? (skill.buff ?? null) : null
    if (!isJsonObject(value)) {
      return value
    }

    return { ...value, [key]: list(value[key], item) }
  }
  const { status, equipment, oath } = input
  const oathValue = oath.oath
  const mappedOath = isJsonObject(oathValue)
    ? { ...oathValue, info: item(oathValue.info), crystal: list(oathValue.crystal, item) }
    : oathValue
  const { status: _stats, buff: _buff, ...header } = status
  const skillStyle = input.skill_style.skill
  const enrichedSkillStyle = isJsonObject(skillStyle)
    ? { ...skillStyle, skillDetails: {} }
    : skillStyle
  const metadata = {
    revision: 1,
    contentUpdatedAt: FETCHED_AT,
    lastSuccessfulFetchAt: FETCHED_AT
  }

  return {
    character: {
      ...header,
      serverId: String(header.serverId),
      characterId: String(header.characterId),
      characterName: String(header.characterName),
      serverName: ''
    },
    status: { status: status.status, buff: status.buff },
    equipment: {
      equipment: list(equipment.equipment, item),
      setItemInfo: equipment.setItemInfo
    },
    avatar: list(input.avatar.avatar, item),
    creature: item(input.creature.creature),
    oath: mappedOath,
    mistAssimilation: input.mist_assimilation.mistAssimilation,
    skillStyle: enrichedSkillStyle,
    buff: {
      equipment: buff(input.buff_equip_equipment, 'equipment'),
      avatar: buff(input.buff_equip_avatar, 'avatar'),
      creature: buff(input.buff_equip_creature, 'creature')
    },
    sections: { basic: metadata, status: metadata },
    freshness: { lastSuccessfulFetchAt: FETCHED_AT, expiresAt: FETCHED_AT },
    setDetails: {},
    card
  }
}

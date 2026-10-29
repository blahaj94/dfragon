import { isRecord } from '@dfragon/lib/utils/shape-check'
import { fromKeys } from 'remeda'
import { NEOPLE_SERVER_NAMES } from '../../constants/neople-character-search.js'
import { CHARACTER_CACHE_TTL_MS } from './character-cache.js'
import { characterDetailSections } from './sections.js'
import type {
  CharacterDetailSection,
  CharacterIdentity,
  CharacterPayload,
  CharacterPayloads
} from './sections.js'

const basicFields = [
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

function projectCharacter(
  identity: CharacterIdentity,
  payload: CharacterPayload
): CharacterPayload {
  const character: CharacterPayload = { ...identity }
  character.serverName = NEOPLE_SERVER_NAMES.get(identity.serverId) ?? null
  const basic = fromKeys(basicFields, (field) => {
    const value = payload[field] ?? null

    return value
  })

  return Object.assign(character, basic)
}

// All sections are cached as one fetch, so each has revision 1 and both timestamps are its Neople fetch time.
function projectSectionMetadata(
  fetchedAt: Date
): Record<string, { revision: number; contentUpdatedAt: string; lastSuccessfulFetchAt: string }> {
  const at = fetchedAt.toISOString()

  return fromKeys(characterDetailSections, () => ({
    revision: 1,
    contentUpdatedAt: at,
    lastSuccessfulFetchAt: at
  }))
}

export function projectCharacterFreshness(fetchedAt: Date) {
  const lastSuccessfulFetchAt = fetchedAt.toISOString()
  const expiresAt = new Date(fetchedAt.getTime() + CHARACTER_CACHE_TTL_MS).toISOString()

  return { lastSuccessfulFetchAt, expiresAt }
}

export function projectCharacterDetails(
  identity: CharacterIdentity,
  payloads: CharacterPayloads,
  fetchedAt: Date
) {
  const body = (section: CharacterDetailSection) => payloads[section]
  const basic = body('basic')
  const character = projectCharacter(identity, basic)
  const sectionBuff = (section: CharacterDetailSection) => {
    const skill = body(section).skill
    const value = isRecord(skill) ? (skill.buff ?? null) : null

    return value
  }
  const stats = body('status').status
  const statusBuff = body('status').buff
  const status = { status: stats, buff: statusBuff }
  const items = body('equipment').equipment
  const setItemInfo = body('equipment').setItemInfo
  const equipment = { equipment: items, setItemInfo }
  const avatar = body('avatar').avatar
  const creature = body('creature').creature
  const oath = body('oath').oath
  const mistAssimilation = body('mist_assimilation').mistAssimilation
  const skillStyle = body('skill_style').skill
  const buffEquipment = sectionBuff('buff_equipment')
  const buffAvatar = sectionBuff('buff_avatar')
  const buffCreature = sectionBuff('buff_creature')
  const buff = { equipment: buffEquipment, avatar: buffAvatar, creature: buffCreature }
  const sections = projectSectionMetadata(fetchedAt)

  return {
    character,
    status,
    equipment,
    avatar,
    creature,
    oath,
    mistAssimilation,
    skillStyle,
    buff,
    sections
  }
}

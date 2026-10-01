import { fromEntries, fromKeys } from 'remeda'
import { NEOPLE_SERVER_NAMES } from '../../constants/neople-character-search.js'
import type { CharacterApiResponse } from '../../database/schemas/character-api-responses.js'
import { CharacterDetailFailure } from './errors.js'
import { isObject } from './neople.js'
import { characterDetailSections } from './sections.js'
import type { CharacterIdentity, CharacterPayload } from './sections.js'

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

function projectSectionMetadata(
  rows: ReadonlyMap<CharacterApiResponse['section'], CharacterApiResponse>
): Record<string, { revision: number; contentUpdatedAt: string; lastSuccessfulFetchAt: string }> {
  const entries = characterDetailSections.map((section) => {
    const row = rows.get(section)!
    const revision = row.revision
    const contentUpdatedAt = row.contentUpdatedAt.toISOString()
    const lastSuccessfulFetchAt = row.lastSuccessfulFetchAt.toISOString()
    const metadata = { revision, contentUpdatedAt, lastSuccessfulFetchAt }

    return [section, metadata] as const
  })
  const metadata = fromEntries(entries)

  return metadata
}

export function projectCharacterDetails(identity: CharacterIdentity, rows: CharacterApiResponse[]) {
  const bySection = new Map(rows.map((row) => [row.section, row]))
  for (const section of characterDetailSections) {
    if (!bySection.has(section)) {
      throw new CharacterDetailFailure('internal')
    }
  }
  const body = (section: CharacterApiResponse['section']) => bySection.get(section)!.payload
  const basic = body('basic')
  const character = projectCharacter(identity, basic)
  const sectionBuff = (section: CharacterApiResponse['section']) => {
    const skill = body(section).skill
    const value = isObject(skill) ? (skill.buff ?? null) : null

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
  const sections = projectSectionMetadata(bySection)

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

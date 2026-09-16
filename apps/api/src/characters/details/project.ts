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

export function projectCharacterDetails(identity: CharacterIdentity, rows: CharacterApiResponse[]) {
  const bySection = new Map(rows.map((row) => [row.section, row]))
  for (const section of characterDetailSections) {
    if (!bySection.has(section)) {
      throw new CharacterDetailFailure('internal')
    }
  }
  const body = (section: CharacterApiResponse['section']) => bySection.get(section)!.payload
  const basic = body('basic')
  const character: CharacterPayload = {
    ...identity,
    serverName: NEOPLE_SERVER_NAMES.get(identity.serverId) ?? null
  }
  for (const field of basicFields) {
    character[field] = basic[field] ?? null
  }
  const buff = (section: CharacterApiResponse['section']) => {
    const skill = body(section).skill
    return isObject(skill) ? (skill.buff ?? null) : null
  }
  return {
    character,
    status: { status: body('status').status, buff: body('status').buff },
    equipment: {
      equipment: body('equipment').equipment,
      setItemInfo: body('equipment').setItemInfo
    },
    avatar: body('avatar').avatar,
    creature: body('creature').creature,
    oath: body('oath').oath,
    mistAssimilation: body('mist_assimilation').mistAssimilation,
    skillStyle: body('skill_style').skill,
    buff: {
      equipment: buff('buff_equipment'),
      avatar: buff('buff_avatar'),
      creature: buff('buff_creature')
    },
    sections: Object.fromEntries(
      characterDetailSections.map((section) => {
        const row = bySection.get(section)!
        return [
          section,
          {
            revision: row.revision,
            contentUpdatedAt: row.contentUpdatedAt.toISOString(),
            lastSuccessfulFetchAt: row.lastSuccessfulFetchAt.toISOString()
          }
        ]
      })
    )
  }
}

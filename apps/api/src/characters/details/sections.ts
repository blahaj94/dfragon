export const CHARACTER_DETAIL_SECTIONS = {
  basic: '',
  status: '/status',
  equipment: '/equip/equipment',
  avatar: '/equip/avatar',
  creature: '/equip/creature',
  oath: '/equip/oath',
  mist_assimilation: '/equip/mist-assimilation',
  skill_style: '/skill/style',
  buff_equipment: '/skill/buff/equip/equipment',
  buff_avatar: '/skill/buff/equip/avatar',
  buff_creature: '/skill/buff/equip/creature'
} as const

export type CharacterDetailSection = keyof typeof CHARACTER_DETAIL_SECTIONS
export const characterDetailSections = Object.keys(
  CHARACTER_DETAIL_SECTIONS
) as CharacterDetailSection[]

export interface CharacterIdentity {
  characterId: string
  serverId: string
}

export type CharacterPayload = Record<string, unknown>
export type CharacterPayloads = Record<CharacterDetailSection, CharacterPayload>

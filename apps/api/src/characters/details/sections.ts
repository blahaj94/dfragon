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

export type { CharacterIdentity } from '../identity.js'

export type CharacterPayload = Record<string, unknown>

/** Neople에서 한 번에 받은 section 응답이다. 저장하지 않으므로 revision은 항상 1이다. */
export interface CharacterSectionResponse {
  section: CharacterDetailSection
  payload: CharacterPayload
  revision: number
  contentUpdatedAt: Date
  lastSuccessfulFetchAt: Date
}
export type CharacterPayloads = Record<CharacterDetailSection, CharacterPayload>

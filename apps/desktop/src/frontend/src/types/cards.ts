import type { ServerId } from './servers'
import type { detailFaces } from '../constants/cards'
import type { SearchSlot } from '../../../preload/common/types/search'

export type DetailFace = (typeof detailFaces)[number]
export type SlotState = SearchSlot['state']

export interface EquipmentSlot {
  id: string
  label: string
  image?: string
  rarityColor: string
  enhancement?: string
  enchantment?: '종결' | '준종결' | '기타'
}

export interface CardCharacter {
  characterId?: string
  name: string
  adventure: string
  /** 길드 이름. 검색 응답에는 아직 없어 합성 미리보기만 채운다. */
  guild?: string
  job: string
  serverId: ServerId
  fame: number | null
  level?: number | null
  equipmentScore?: number
  /** 서버 순위. 검색 응답에는 아직 없어 합성 미리보기만 채운다. */
  serverRank?: number
  image?: string
  equipment: EquipmentSlot[]
  oath: EquipmentSlot[]
}

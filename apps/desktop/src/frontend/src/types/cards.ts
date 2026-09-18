import type { ServerId } from './servers'
import type { detailFaces } from '../constants/cards'

export type DetailFace = (typeof detailFaces)[number]
export type SlotState = 'idle' | 'pending' | 'success' | 'empty' | 'failure'

export interface EquipmentSlot {
  id: string
  label: string
  image?: string
  rarityColor: string
  enhancement?: string
  enchantment?: '종결' | '준종결' | '기타'
}

export interface CardCharacter {
  name: string
  adventure: string
  job: string
  serverId: ServerId
  fame: number
  equipmentScore?: number
  image?: string
  equipment: EquipmentSlot[]
  oath: EquipmentSlot[]
}

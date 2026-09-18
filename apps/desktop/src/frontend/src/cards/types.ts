import type { ServerId } from './servers'

export const cardFaces = ['캐릭터', '장비', '서약', '투자 현황'] as const
export const detailFaces = ['장비', '서약', '강화', '마법부여', '스킬트리'] as const
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

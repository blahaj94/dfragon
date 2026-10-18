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

/** 상위, 랭커 단계. 나누는 기준(명성, 장비 점수, 서버 순위)이 아직 없어 합성 미리보기만 채운다. */
export type CharacterTier = 'top' | 'ranker'

/**
 * 공대 카드의 스탯 한 줄. 딜러와 버퍼가 보이는 값이 다르다. 값은 화면 단위로 줄이기 전의 원래 수치이고,
 * 모르는 값은 null이다.
 */
export type CardStats =
  | {
      role: 'dealer'
      /** 공격력 증가(%) */
      attackIncrease: number | null
      /** 증폭(%) */
      amplification: number | null
      /** 크리티컬(%) */
      critical: number | null
      switchingLevel: number | null
    }
  | {
      role: 'buffer'
      /** 마을 지능 */
      townIntelligence: number | null
      /** 30레벨 버프 수치 */
      buff30: number | null
      /** 50레벨 버프 수치 */
      buff50: number | null
      switchingLevel: number | null
    }

export interface CardCharacter {
  characterId?: string
  name: string
  adventure: string
  /** 길드 이름. 상세 응답에 길드가 없으면 null이다. */
  guild?: string | null
  job: string
  serverId: ServerId
  fame: number | null
  level?: number | null
  /** 장비 점수. 검색 응답에 대응 필드가 아직 없어 제품에서는 null이고 합성 미리보기만 채운다. */
  equipmentScore?: number | null
  /** 서버 순위. 검색 응답에 대응 필드가 아직 없어 제품에서는 null이고 합성 미리보기만 채운다. */
  serverRank?: number | null
  /** 상위, 랭커 단계. 검색 응답에는 없어 합성 미리보기만 채운다. */
  tier?: CharacterTier
  /** 공대 카드의 스탯 한 줄. 검색 응답에 대응 필드가 아직 없어 제품에서는 null이고 합성 미리보기만 채운다. */
  stats?: CardStats | null
  image?: string
  equipment: EquipmentSlot[]
  oath: EquipmentSlot[]
}

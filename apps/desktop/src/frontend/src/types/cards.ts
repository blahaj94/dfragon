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
}

/** 상위, 랭커 단계. 나누는 기준(명성, 장비 점수, 서버 순위)이 아직 없어 합성 미리보기만 채운다. */
export type CharacterTier = 'top' | 'ranker'

/**
 * 카드 세 면과 공대 카드 스탯 한 줄의 값(Issue #716 공유 계약). API가 저장된 Neople 섹션으로 투영하고 Desktop
 * main이 점수 엔진 결과를 채운 숫자와 enum이며, 모르는 값은 0이나 빈 값이 아니라 null이다.
 * 3번 항목(preload의 `CharacterCard`)이 merge되면 이 타입은 preload 타입 import로 바꾼다.
 */
export type CharacterCard = {
  role: 'dealer' | 'buffer' | null
  stats:
    | {
        role: 'dealer'
        attackIncrease: number | null
        amplification: number | null
        critical: number | null
        switchingLevel: number | null
      }
    | {
        role: 'buffer'
        townIntelligence: number | null
        buff30: number | null
        buff50: number | null
        switchingLevel: number | null
      }
    | null
  score: {
    calculator: 'equipment' | 'buff'
    value: number | null
    skipped: { kind: string; message: string } | null
    versions: { package: string; rulesRev: string; bundleId: string }
  } | null
  serverRank: {
    rank: number
    total: number
    basis: 'fame'
    scope: 'stored'
    observedAt: string
  } | null
  set: {
    setItemId: string
    name: string
    rarityName: string | null
    point: { current: number; min: number; max: number } | null
    imageItemId: string | null
    slots: { slotId: string; rarity: string | null }[]
    rarityCounts: { rarity: string; count: number }[]
  } | null
  oath: {
    itemId: string
    name: string
    rarity: string | null
    point: number | null
    setName: string | null
    optionName: string | null
    setPoint: { current: number; min: number; max: number } | null
    upgrades: { step: number; stepName: string; optionName: string }[]
    crystals: {
      slotNo: number
      itemId: string
      name: string
      rarity: string | null
      setPoint: number | null
    }[]
    rarityCounts: { rarity: string; count: number }[]
  } | null
  investment: {
    slotId: string
    slotName: string
    itemId: string | null
    itemName: string | null
    rarity: string | null
    reinforce: {
      kind: 'reinforce' | 'amplify'
      value: number
      amplificationName: string | null
    } | null
    enchant: {
      status: { name: string; value: number | string }[]
      grade: '종결' | '준종결' | '기타' | null
    } | null
  }[]
}

/**
 * 스탯 한 줄. 딜러와 버퍼가 보이는 값이 다르다. 값은 화면 단위로 줄이기 전의 원래 수치이고, 모르는 값은
 * null이다.
 */
export type CardStats = NonNullable<CharacterCard['stats']>

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
  /** 상위, 랭커 단계. 검색 응답에는 없어 합성 미리보기만 채운다. */
  tier?: CharacterTier
  /** 스탯, 장비 점수, 서버 순위, 세트, 서약, 강화와 마법부여. main이 넘기지 않았으면 null이다. */
  card: CharacterCard | null
  image?: string
  equipment: EquipmentSlot[]
  oath: EquipmentSlot[]
}

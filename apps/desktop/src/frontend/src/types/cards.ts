import type { ServerId } from './servers'
import type { SearchSlot } from '../../../preload/common/types/search'
import type { CharacterCard } from '../../../preload/common/types/character'

export type SlotState = SearchSlot['state']

/** 상위, 랭커 단계. 나누는 기준(명성, 장비 점수)이 아직 없어 합성 미리보기만 채운다. */
export type CharacterTier = 'top' | 'ranker'

/** 카드의 역할과 점수. Desktop main이 점수 엔진 결과를 채워 검증한 값이며, 모르는 값은 null이다. */
export type { CharacterCard }

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
  /** 역할과 장비 점수. main이 넘기지 않았으면 null이다. */
  card: CharacterCard | null
  image?: string
}

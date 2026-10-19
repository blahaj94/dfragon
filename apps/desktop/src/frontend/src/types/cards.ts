import type { ServerId } from './servers'
import type { SearchSlot } from '../../../preload/common/types/search'
import type { CharacterCard } from '../../../preload/common/types/character'
import type { CharacterDetailItemTexts } from '../../../preload/common/types/character-detail'

export type SlotState = SearchSlot['state']

/** 상위, 랭커 단계. 나누는 기준(명성, 장비 점수, 서버 순위)이 아직 없어 합성 미리보기만 채운다. */
export type CharacterTier = 'top' | 'ranker'

/**
 * 카드 세 면과 공대 카드 스탯 한 줄의 값(Issue #716 공유 계약). API가 저장된 Neople 섹션으로 투영하고 Desktop
 * main이 점수 엔진 결과를 채워 검증한 숫자와 enum이며, 모르는 값은 0이나 빈 값이 아니라 null이다.
 */
export type { CharacterCard }

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
  /**
   * 카드 값의 Neople itemId에 대응하는 로컬 아이템 그림. 합성 미리보기만 채우고, 제품은 비워 두어 renderer가
   * itemId로 고정 origin URL을 만든다.
   */
  itemImages?: Readonly<Record<string, string>>
  /** 상세 창 설명 상자의 itemId별 문구. 합성 미리보기만 채우고, 제품 상세 창은 main이 넘긴 값을 쓴다. */
  itemTexts?: CharacterDetailItemTexts
}

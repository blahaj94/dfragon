import type { CharacterCard, CharacterDetails, CharacterSummary } from './character'

export type CharacterSelectionReference = Readonly<{
  captureId: string
  slot: number
  requestId: string
}>

/**
 * 장비 설명 상자의 아이템 문구. 상세 응답 아이템 상세(`itemDetail.data`)의 원문 그대로이고, 원문이 비었거나
 * 없으면 null이다. `explain`은 `itemExplain`, `buff`는 `itemBuff.explain`, `flavor`는 `itemFlavorText`다.
 */
export type CharacterDetailItemText = Readonly<{
  explain: string | null
  buff: string | null
  flavor: string | null
}>

/** 장비 12부위와 서약 본체, 결정의 itemId별 설명 상자 문구. 아이템 상세를 받지 못한 아이템은 넣지 않는다. */
export type CharacterDetailItemTexts = Readonly<Record<string, CharacterDetailItemText>>

/**
 * 캐릭터가 익힌 스킬 하나. 이름과 레벨은 스킬 스타일 원문이고, 나머지는 같은 스킬의 공용 상세
 * (`skillDetails[skillId].data`)에서 고른다. `description`은 `desc` 원문, `coolTime`은 현재 레벨 줄의
 * `coolTime`(초)이고 상세가 없거나 값이 없으면 null이다. `vpNames`는 상세 `evolution` 항목의 이름을 type
 * 순서로 담고, `vpName`은 그중 스킬 스타일 진화의 type과 같은 항목, 고르지 않았으면 null이다.
 */
export type CharacterDetailSkill = Readonly<{
  name: string
  level: number
  description: string | null
  coolTime: number | null
  vpNames: readonly string[]
  vpName: string | null
}>

/**
 * 스킬 탭에 넘기는 캐릭터 스킬. 직업 배치를 찾는 기본정보의 `jobId`, `jobGrowId`와 습득, 패시브 스킬을
 * skillId별로 담는다. 배치에 있으나 여기에 없는 스킬은 익히지 않은 스킬이다.
 */
export type CharacterDetailSkills = Readonly<{
  jobId: string
  jobGrowId: string
  learned: Readonly<Record<string, CharacterDetailSkill>>
}>

/**
 * 상세 창이 연 순간의 캐릭터 정보. `card`는 메인 카드와 같은 카드 값(API 투영에 main이 점수를 채운 값)이며
 * main이 검증하지 못했으면 null이다. `skills`는 직업 ID나 스킬 스타일을 읽지 못했으면 null이다.
 */
export type CharacterDetailSnapshot = Readonly<{
  character: CharacterSummary & Readonly<{ guildName: string | null }>
  card: CharacterCard | null
  itemTexts: CharacterDetailItemTexts
  skills: CharacterDetailSkills | null
  freshness: CharacterDetails['freshness']
}>

export type OpenCharacterDetailResult = Readonly<{ ok: boolean }>

export type CharacterDetailApi = Readonly<{
  read: () => Promise<CharacterDetailSnapshot>
}>

declare global {
  interface Window {
    characterDetail: CharacterDetailApi
  }
}

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
 * 상세 창이 연 순간의 캐릭터 정보. `card`는 메인 카드와 같은 카드 값(API 투영에 main이 점수를 채운 값)이며
 * main이 검증하지 못했으면 null이다.
 */
export type CharacterDetailSnapshot = Readonly<{
  character: CharacterSummary & Readonly<{ guildName: string | null }>
  card: CharacterCard | null
  itemTexts: CharacterDetailItemTexts
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

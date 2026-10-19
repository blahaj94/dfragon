import type { CharacterCard, CharacterDetails, CharacterSummary } from './character'

export type CharacterSelectionReference = Readonly<{
  captureId: string
  slot: number
  requestId: string
}>

/**
 * 상세 창이 연 순간의 캐릭터 정보. `card`는 메인 카드와 같은 카드 값(API 투영에 main이 점수를 채운 값)이며
 * main이 검증하지 못했으면 null이다.
 */
export type CharacterDetailSnapshot = Readonly<{
  character: CharacterSummary & Readonly<{ guildName: string | null }>
  card: CharacterCard | null
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

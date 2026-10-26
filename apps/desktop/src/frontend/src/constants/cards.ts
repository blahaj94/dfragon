import type { CharacterTier } from '../types/cards'

// 상위, 랭커 단계의 이름. 화면에는 꺾쇠와 색으로 보이고 보조 기술에는 이 이름으로 전한다.
export const tierLabels: Readonly<Record<CharacterTier, string>> = { top: '상위', ranker: '랭커' }

// 공대는 네 명씩 세 파티, 12자리다.
export const RAID_PARTY_COUNT = 3
export const RAID_PARTY_SIZE = 4

// 카드에서 검색 응답에 없거나 null인 값의 자리 표시. 0이나 빈칸으로 바꾸지 않는다.
export const MISSING_VALUE = '-'

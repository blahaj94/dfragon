import type { CharacterTier } from '../types/cards'

export const cardFaces = ['캐릭터', '장비', '서약', '투자 현황'] as const
export const detailFaces = ['장비', '서약', '강화', '마법부여', '스킬트리'] as const

// 상위, 랭커 단계의 이름. 화면에는 꺾쇠와 색으로 보이고 보조 기술에는 이 이름으로 전한다.
export const tierLabels: Readonly<Record<CharacterTier, string>> = { top: '상위', ranker: '랭커' }

// 공대는 네 명씩 세 파티, 12자리다.
export const RAID_PARTY_COUNT = 3
export const RAID_PARTY_SIZE = 4

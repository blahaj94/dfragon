import type { CharacterCard } from '../types/character'

// API 상세 응답의 카드 투영. API는 역할만 정하고 점수 자리는 비워 두며 Desktop main이 채운다.
export const dealerCard: CharacterCard = { role: 'dealer', score: null }

export const bufferCard: CharacterCard = { role: 'buffer', score: null }

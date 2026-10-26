import type { CharacterCard } from '../../types/cards'

// 캐릭터 면 카드 예시. 점수는 dnf-reverse-engineering golden 벡터의 가명 표본(딜러
// `dealer-weapon-master-scored-0046ae4b`, 버퍼 `buffer-enchantress-scored-031ca272`)의 기대값이다.

export const dealerCard: CharacterCard = {
  role: 'dealer',
  score: {
    calculator: 'equipment',
    value: 330556,
    skipped: null,
    approximate: null,
    versions: { package: 'dnfscore', rulesRev: 'rev12', bundleId: 'phase31-rev12' }
  }
}

export const bufferCard: CharacterCard = {
  role: 'buffer',
  score: {
    calculator: 'buff',
    value: 55358,
    skipped: null,
    approximate: null,
    versions: { package: 'dnfscore', rulesRev: 'rev12', bundleId: 'phase31-rev12' }
  }
}

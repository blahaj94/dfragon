import type { CharacterCard } from '../types/character'

// API 1번 항목의 실응답 모양 fixture가 들어오면 그 `card`로 바꾼다. 값은 합성이며 실제 캐릭터가 아니다.
export const dealerCard: CharacterCard = {
  role: 'dealer',
  stats: {
    role: 'dealer',
    attackIncrease: 34458,
    amplification: 302,
    critical: 117.5,
    switchingLevel: null
  },
  score: null,
  serverRank: {
    rank: 12,
    total: 3400,
    basis: 'fame',
    scope: 'stored',
    observedAt: '2026-10-19T00:00:00.000Z'
  },
  set: {
    setItemId: 'synthetic-set',
    name: '합성 세트',
    rarityName: '태초',
    point: { current: 2550, min: 2550, max: 2805 },
    imageItemId: 'synthetic-weapon',
    slots: [
      { slotId: 'WEAPON', rarity: '태초' },
      { slotId: 'JACKET', rarity: null }
    ],
    rarityCounts: [{ rarity: '태초', count: 1 }]
  },
  oath: {
    itemId: 'synthetic-oath',
    name: '합성 서약',
    rarity: '에픽',
    point: 1200,
    setName: '합성 서약 세트',
    optionName: '합성 옵션',
    setPoint: { current: 1200, min: 0, max: 1500 },
    upgrades: [{ step: 1, stepName: '1단계', optionName: '합성 진의' }],
    crystals: [
      {
        slotNo: 1,
        itemId: 'synthetic-crystal',
        name: '합성 결정',
        rarity: '레전더리',
        setPoint: 40
      }
    ],
    rarityCounts: [{ rarity: '레전더리', count: 1 }]
  },
  investment: [
    {
      slotId: 'WEAPON',
      slotName: '무기',
      itemId: 'synthetic-weapon',
      itemName: '합성 무기',
      rarity: '태초',
      reinforce: { kind: 'amplify', value: 12, amplificationName: '차원의 지능' },
      enchant: { status: [{ name: '지능', value: 60 }], grade: '종결' }
    },
    {
      slotId: 'JACKET',
      slotName: '상의',
      itemId: null,
      itemName: null,
      rarity: null,
      reinforce: null,
      enchant: null
    }
  ]
}

export const bufferCard: CharacterCard = {
  ...dealerCard,
  role: 'buffer',
  stats: {
    role: 'buffer',
    townStatName: '정신력',
    townStat: 9120,
    buff30: null,
    buff50: null,
    switchingLevel: null
  }
}

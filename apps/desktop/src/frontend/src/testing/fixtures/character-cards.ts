import type { CharacterCard } from '../../types/cards'

// Issue #716 공유 계약 모양의 카드 예시. dnf-reverse-engineering golden 벡터의 가명 표본(딜러
// `dealer-weapon-master-scored-0046ae4b`, 버퍼 `buffer-enchantress-scored-031ca272`)의 `input`을 계약대로 손으로
// 투영했다. 점수는 그 벡터의 기대값이고, 가명 표본에는 명성이 없어 서버 순위는 합성 값이다. 마법부여 등급표(2번
// 항목)가 아직 없어 등급은 세 등급과 미평가가 모두 보이도록 넣은 합성 값이다. 1번 항목의 API 응답 fixture가
// merge되면 그 fixture로 바꾼다.

export const dealerCard: CharacterCard = {
  role: 'dealer',
  stats: {
    role: 'dealer',
    attackIncrease: 71104.5,
    amplification: 76,
    critical: 101.1,
    switchingLevel: null
  },
  score: {
    calculator: 'equipment',
    value: 330556,
    skipped: null,
    approximate: null,
    versions: { package: 'dnfscore', rulesRev: 'rev12', bundleId: 'phase31-rev12' }
  },
  serverRank: {
    rank: 18240,
    total: 52310,
    basis: 'fame',
    scope: 'stored',
    observedAt: '2026-10-19T00:00:00.000Z'
  },
  set: {
    setItemId: '93e7825053bdec4e0f4c12837cf4f57e',
    name: '환상의 에테리얼 오브 아츠 세트',
    rarityName: '태초',
    point: { current: 2625, min: 2550, max: 2550 },
    imageItemId: '2d23a5dc389016bdc3a3e3fd142b38ce',
    slots: [
      { slotId: 'JACKET', rarity: '에픽', exclusive: false },
      { slotId: 'SHOULDER', rarity: '에픽', exclusive: false },
      { slotId: 'PANTS', rarity: '에픽', exclusive: false },
      { slotId: 'SHOES', rarity: '에픽', exclusive: false },
      { slotId: 'WAIST', rarity: '에픽', exclusive: false },
      { slotId: 'AMULET', rarity: '태초', exclusive: false },
      { slotId: 'WRIST', rarity: '태초', exclusive: false },
      { slotId: 'RING', rarity: '태초', exclusive: false },
      { slotId: 'SUPPORT', rarity: '에픽', exclusive: false },
      { slotId: 'MAGIC_STON', rarity: '에픽', exclusive: false },
      { slotId: 'EARRING', rarity: '에픽', exclusive: false }
    ],
    rarityCounts: [
      { rarity: '태초', count: 3 },
      { rarity: '에픽', count: 8 }
    ]
  },
  oath: {
    itemId: '15a42c9cfd0709f609b22bb590f0a1e8',
    name: '강림한 여우 서약',
    rarity: '태초',
    point: 655,
    setName: '조화의 여우 서약',
    optionName: '여우 : 초월',
    setPoint: { current: 2630, min: 2550, max: 2550 },
    upgrades: [
      { step: 1, stepName: '<묵언의 진의> - 첫 번째 진의', optionName: '강인한 통찰' },
      { step: 2, stepName: '<묵언의 진의> - 두 번째 진의', optionName: '포용의 권능' },
      { step: 3, stepName: '<묵언의 진의> - 세 번째 진의', optionName: '심연의 고동' },
      { step: 4, stepName: '<묵언의 진의> - 네 번째 진의', optionName: '신념의 대가' },
      { step: 5, stepName: '<묵언의 진의> - 다섯 번째 진의', optionName: '이어진 걸음' },
      { step: 6, stepName: '<묵언의 진의> - 여섯 번째 진의', optionName: '영원의 궤적' },
      { step: 7, stepName: '<묵언의 진의> - 일곱 번째 진의', optionName: '만물의 흐름' },
      { step: 8, stepName: '<묵언의 진의> - 여덟 번째 진의', optionName: '순례자의 길' }
    ],
    crystals: [
      {
        slotNo: 0,
        itemId: '05efe7c9d4cf9f5bd0fc1aa56f1cf157',
        name: '여우 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 185
      },
      {
        slotNo: 1,
        itemId: '05efe7c9d4cf9f5bd0fc1aa56f1cf157',
        name: '여우 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 185
      },
      {
        slotNo: 2,
        itemId: '05efe7c9d4cf9f5bd0fc1aa56f1cf157',
        name: '여우 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 165
      },
      {
        slotNo: 3,
        itemId: '05efe7c9d4cf9f5bd0fc1aa56f1cf157',
        name: '여우 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 165
      },
      {
        slotNo: 4,
        itemId: '05efe7c9d4cf9f5bd0fc1aa56f1cf157',
        name: '여우 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 165
      },
      {
        slotNo: 5,
        itemId: '05efe7c9d4cf9f5bd0fc1aa56f1cf157',
        name: '여우 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 165
      },
      {
        slotNo: 6,
        itemId: '05efe7c9d4cf9f5bd0fc1aa56f1cf157',
        name: '여우 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 165
      },
      {
        slotNo: 7,
        itemId: '05efe7c9d4cf9f5bd0fc1aa56f1cf157',
        name: '여우 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 165
      },
      {
        slotNo: 8,
        itemId: 'c78cae5798f4b3d8991323d6e9274463',
        name: '여우 : 태초의 광휘 결정',
        rarity: '태초',
        setPoint: 205
      },
      {
        slotNo: 9,
        itemId: 'c78cae5798f4b3d8991323d6e9274463',
        name: '여우 : 태초의 광휘 결정',
        rarity: '태초',
        setPoint: 205
      },
      {
        slotNo: 10,
        itemId: 'c78cae5798f4b3d8991323d6e9274463',
        name: '여우 : 태초의 광휘 결정',
        rarity: '태초',
        setPoint: 205
      }
    ],
    rarityCounts: [
      { rarity: '태초', count: 3 },
      { rarity: '에픽', count: 8 }
    ]
  },
  investment: [
    {
      slotId: 'WEAPON',
      slotName: '무기',
      itemId: '4f7c8199cd7a85492e985ebb5daa2da8',
      itemName: '검은 질병의 멸룡검 발뭉',
      rarity: '태초',
      exclusive: false,
      reinforce: { kind: 'reinforce', value: 13, amplificationName: null },
      enchant: {
        status: [
          { name: '모든 속성 강화', value: 15 },
          { name: '물리 공격력', value: 30 },
          { name: '마법 공격력', value: 30 },
          { name: '독립 공격력', value: 30 }
        ],
        grade: '종결'
      }
    },
    {
      slotId: 'JACKET',
      slotName: '상의',
      itemId: '2d23a5dc389016bdc3a3e3fd142b38ce',
      itemName: '긍휼 속 자비의 상의',
      rarity: '에픽',
      exclusive: false,
      reinforce: { kind: 'reinforce', value: 10, amplificationName: null },
      enchant: {
        status: [
          { name: '최종 데미지 증가', value: '1%' },
          { name: '물리 공격력', value: 110 },
          { name: '마법 공격력', value: 110 },
          { name: '독립 공격력', value: 110 },
          { name: '힘', value: 90 },
          { name: '지능', value: 90 }
        ],
        grade: '준종결'
      }
    },
    {
      slotId: 'SHOULDER',
      slotName: '머리어깨',
      itemId: '1b62c240c5a0a893a77149ef5b923bbb',
      itemName: '숭고한 심판의 어깨',
      rarity: '에픽',
      exclusive: false,
      reinforce: { kind: 'reinforce', value: 10, amplificationName: null },
      enchant: {
        status: [
          { name: '힘', value: 40 },
          { name: '지능', value: 40 },
          { name: '체력', value: 40 },
          { name: '정신력', value: 40 },
          { name: '물리 공격력', value: 10 },
          { name: '마법 공격력', value: 10 },
          { name: '독립 공격력', value: 10 },
          { name: '물리 크리티컬 히트', value: '5%' },
          { name: '마법 크리티컬 히트', value: '5%' },
          { name: '최종 데미지 증가', value: '2%' }
        ],
        grade: '종결'
      }
    },
    {
      slotId: 'PANTS',
      slotName: '하의',
      itemId: 'cd04be485e258d9879cd6d3b9bb3f2c6',
      itemName: '명예로운 공경의 하의',
      rarity: '에픽',
      exclusive: false,
      reinforce: { kind: 'reinforce', value: 10, amplificationName: null },
      enchant: {
        status: [
          { name: '최종 데미지 증가', value: '2%' },
          { name: '물리 공격력', value: 110 },
          { name: '마법 공격력', value: 110 },
          { name: '독립 공격력', value: 110 },
          { name: '힘', value: 90 },
          { name: '지능', value: 90 }
        ],
        grade: '기타'
      }
    },
    {
      slotId: 'WAIST',
      slotName: '벨트',
      itemId: 'e73e2b5f535f2ec8edbf29d5ba1ef2e9',
      itemName: '완전한 침묵의 벨트',
      rarity: '에픽',
      exclusive: false,
      reinforce: { kind: 'reinforce', value: 10, amplificationName: null },
      enchant: {
        status: [
          { name: '힘', value: 50 },
          { name: '지능', value: 50 },
          { name: '체력', value: 50 },
          { name: '정신력', value: 50 },
          { name: '물리 공격력', value: 15 },
          { name: '마법 공격력', value: 15 },
          { name: '독립 공격력', value: 15 },
          { name: '물리 크리티컬 히트', value: '3%' },
          { name: '마법 크리티컬 히트', value: '3%' },
          { name: '최종 데미지 증가', value: '3%' }
        ],
        grade: '종결'
      }
    },
    {
      slotId: 'SHOES',
      slotName: '신발',
      itemId: 'a4e3544bd415bcf6399809025bc3de32',
      itemName: '고요한 안식의 신발',
      rarity: '에픽',
      exclusive: false,
      reinforce: { kind: 'reinforce', value: 10, amplificationName: null },
      enchant: {
        status: [
          { name: '힘', value: 40 },
          { name: '지능', value: 40 },
          { name: '체력', value: 40 },
          { name: '정신력', value: 40 },
          { name: '물리 공격력', value: 10 },
          { name: '마법 공격력', value: 10 },
          { name: '독립 공격력', value: 10 },
          { name: '최종 데미지 증가', value: '2%' },
          { name: '물리 크리티컬 히트', value: '3%' },
          { name: '마법 크리티컬 히트', value: '3%' }
        ],
        grade: '준종결'
      }
    },
    {
      slotId: 'AMULET',
      slotName: '목걸이',
      itemId: '0b282cdf1ebaf35acaf2753a04523c25',
      itemName: '성스러운 믿음의 목걸이',
      rarity: '태초',
      exclusive: false,
      reinforce: { kind: 'amplify', value: 10, amplificationName: '차원의 힘' },
      enchant: { status: [{ name: '모든 속성 강화', value: 33 }], grade: '준종결' }
    },
    {
      slotId: 'WRIST',
      slotName: '팔찌',
      itemId: '61ee9ec4dfd2bf600529115950c9a841',
      itemName: '드러난 진실의 팔찌',
      rarity: '태초',
      exclusive: false,
      reinforce: { kind: 'amplify', value: 10, amplificationName: '차원의 힘' },
      enchant: { status: [{ name: '모든 속성 강화', value: 33 }], grade: '종결' }
    },
    {
      slotId: 'RING',
      slotName: '반지',
      itemId: '51bc77072ed77633484ee871d3327821',
      itemName: '거룩한 희생의 반지',
      rarity: '태초',
      exclusive: false,
      reinforce: { kind: 'amplify', value: 10, amplificationName: '차원의 힘' },
      enchant: { status: [{ name: '모든 속성 강화', value: 33 }], grade: '종결' }
    },
    {
      slotId: 'SUPPORT',
      slotName: '보조장비',
      itemId: '2553174da0b1bc3cf1614ea331a0aa0d',
      itemName: '초연한 청렴의 보조장비',
      rarity: '에픽',
      exclusive: false,
      reinforce: { kind: 'amplify', value: 10, amplificationName: '차원의 힘' },
      enchant: {
        status: [
          { name: '물리 크리티컬 히트', value: '3.0%' },
          { name: '마법 크리티컬 히트', value: '3.0%' },
          { name: '모든 속성 강화', value: 12 },
          { name: '공격력 증폭', value: '3%' }
        ],
        grade: null
      }
    },
    {
      slotId: 'MAGIC_STON',
      slotName: '마법석',
      itemId: '06ad4ee0f2071c2cd4d00dd6e168d250',
      itemName: '무결한 순수의 마법석',
      rarity: '에픽',
      exclusive: false,
      reinforce: { kind: 'amplify', value: 10, amplificationName: '차원의 힘' },
      enchant: { status: [{ name: '모든 속성 강화', value: 40 }], grade: '종결' }
    },
    {
      slotId: 'EARRING',
      slotName: '귀걸이',
      itemId: 'fe11b3d169c66fa3cd358e21c51a647e',
      itemName: '강인한 절제의 귀걸이',
      rarity: '에픽',
      exclusive: false,
      reinforce: { kind: 'amplify', value: 10, amplificationName: '차원의 힘' },
      enchant: {
        status: [
          { name: '모든 속성 강화', value: 11 },
          { name: '힘', value: 50 },
          { name: '지능', value: 50 },
          { name: '체력', value: 50 },
          { name: '정신력', value: 50 }
        ],
        grade: '준종결'
      }
    }
  ]
}

export const bufferCard: CharacterCard = {
  role: 'buffer',
  stats: {
    role: 'buffer',
    townStatName: '지능',
    townStat: 7594,
    buff30: null,
    buff50: null,
    switchingLevel: null
  },
  score: {
    calculator: 'buff',
    value: 55358,
    skipped: null,
    approximate: null,
    versions: { package: 'dnfscore', rulesRev: 'rev12', bundleId: 'phase31-rev12' }
  },
  serverRank: {
    rank: 6120,
    total: 52310,
    basis: 'fame',
    scope: 'stored',
    observedAt: '2026-10-19T00:00:00.000Z'
  },
  set: {
    setItemId: '11f7d203a05ea6f13300c0facb39f11e',
    name: '칠흑의 정화 : 균형 세트',
    rarityName: '태초',
    point: { current: 2550, min: 2550, max: 2550 },
    imageItemId: 'd51d0071c181d4fe99b04e19f2fd6a82',
    slots: [
      { slotId: 'JACKET', rarity: '에픽', exclusive: false },
      { slotId: 'SHOULDER', rarity: '레전더리', exclusive: false },
      { slotId: 'PANTS', rarity: '에픽', exclusive: false },
      { slotId: 'SHOES', rarity: '에픽', exclusive: false },
      { slotId: 'WAIST', rarity: '레전더리', exclusive: false },
      { slotId: 'AMULET', rarity: '에픽', exclusive: false },
      { slotId: 'WRIST', rarity: '에픽', exclusive: false },
      { slotId: 'RING', rarity: '에픽', exclusive: false },
      { slotId: 'SUPPORT', rarity: '유니크', exclusive: false },
      { slotId: 'MAGIC_STON', rarity: '에픽', exclusive: false },
      { slotId: 'EARRING', rarity: '레전더리', exclusive: false }
    ],
    rarityCounts: [
      { rarity: '에픽', count: 7 },
      { rarity: '레전더리', count: 3 },
      { rarity: '유니크', count: 1 }
    ]
  },
  oath: {
    itemId: 'a6e5b36dea755a4eea867623ea31083b',
    name: '영원불변의 행운 서약',
    rarity: '태초',
    point: 655,
    setName: '운명의 행운 서약',
    optionName: '행운 : 일궈낸 운명',
    setPoint: { current: 1315, min: 1285, max: 1370 },
    upgrades: [],
    crystals: [
      {
        slotNo: 0,
        itemId: 'ec841699d815e71fcce59b21987af0e9',
        name: '행운 : 희미한 광휘 결정',
        rarity: '유니크',
        setPoint: 85
      },
      {
        slotNo: 1,
        itemId: 'edad105fb2d48e5af6f176f1add46d5c',
        name: '기억의 안개 결정',
        rarity: '레전더리',
        setPoint: 125
      },
      {
        slotNo: 2,
        itemId: 'ec841699d815e71fcce59b21987af0e9',
        name: '행운 : 희미한 광휘 결정',
        rarity: '유니크',
        setPoint: 85
      },
      {
        slotNo: 3,
        itemId: 'ec841699d815e71fcce59b21987af0e9',
        name: '행운 : 희미한 광휘 결정',
        rarity: '유니크',
        setPoint: 85
      },
      {
        slotNo: 4,
        itemId: '5453e2e4176dd8b2bae9d998468e0547',
        name: '무지의 안개 결정 - 목걸이',
        rarity: '레전더리',
        setPoint: 125
      },
      {
        slotNo: 5,
        itemId: 'ec841699d815e71fcce59b21987af0e9',
        name: '행운 : 희미한 광휘 결정',
        rarity: '유니크',
        setPoint: 85
      },
      {
        slotNo: 6,
        itemId: 'bd87e03e27f14bfce5b42064d0c6f974',
        name: '희미한 안개 결정',
        rarity: '유니크',
        setPoint: 85
      },
      {
        slotNo: 7,
        itemId: 'ec841699d815e71fcce59b21987af0e9',
        name: '행운 : 희미한 광휘 결정',
        rarity: '유니크',
        setPoint: 85
      },
      {
        slotNo: 8,
        itemId: 'b9b0f500bc9e87fac9dfde5ecb3e9545',
        name: '창조의 안개 결정 - 반지',
        rarity: '레전더리',
        setPoint: 125
      },
      {
        slotNo: 9,
        itemId: '24882546b3edf28175ec8e85ebc9d5fc',
        name: '무지의 안개 결정 - 팔찌',
        rarity: '레전더리',
        setPoint: 125
      },
      {
        slotNo: 10,
        itemId: 'ec841699d815e71fcce59b21987af0e9',
        name: '행운 : 희미한 광휘 결정',
        rarity: '유니크',
        setPoint: 85
      }
    ],
    rarityCounts: [
      { rarity: '레전더리', count: 4 },
      { rarity: '유니크', count: 7 }
    ]
  },
  investment: [
    {
      slotId: 'WEAPON',
      slotName: '무기',
      itemId: '894e3ce2fb15298feda9cac871b74ea0',
      itemName: '서사시의 영웅담 - 빗자루',
      rarity: '에픽',
      exclusive: false,
      reinforce: { kind: 'amplify', value: 7, amplificationName: '차원의 지능' },
      enchant: {
        status: [
          { name: '힘', value: 75 },
          { name: '지능', value: 75 },
          { name: '체력', value: 75 },
          { name: '정신력', value: 75 }
        ],
        grade: '준종결'
      }
    },
    {
      slotId: 'JACKET',
      slotName: '상의',
      itemId: 'd51d0071c181d4fe99b04e19f2fd6a82',
      itemName: '칠흑의 정화 상의',
      rarity: '에픽',
      exclusive: false,
      reinforce: { kind: 'reinforce', value: 0, amplificationName: null },
      enchant: {
        status: [
          { name: '힘', value: 100 },
          { name: '지능', value: 100 },
          { name: '체력', value: 100 },
          { name: '정신력', value: 100 }
        ],
        grade: '기타'
      }
    },
    {
      slotId: 'SHOULDER',
      slotName: '머리어깨',
      itemId: '2444288a5ba59fe11dacd68b811ffc18',
      itemName: '때 묻지 않은 정화 어깨',
      rarity: '레전더리',
      exclusive: false,
      reinforce: { kind: 'reinforce', value: 0, amplificationName: null },
      enchant: {
        status: [
          { name: '힘', value: 100 },
          { name: '지능', value: 100 },
          { name: '체력', value: 100 },
          { name: '정신력', value: 100 }
        ],
        grade: null
      }
    },
    {
      slotId: 'PANTS',
      slotName: '하의',
      itemId: 'e6a28563ef56dc1fb4d19cd15bf13806',
      itemName: '고유 - 청해의 굳건한 각반',
      rarity: '에픽',
      exclusive: false,
      reinforce: { kind: 'reinforce', value: 0, amplificationName: null },
      enchant: {
        status: [
          { name: '힘', value: 75 },
          { name: '지능', value: 75 },
          { name: '체력', value: 75 },
          { name: '정신력', value: 75 }
        ],
        grade: '기타'
      }
    },
    {
      slotId: 'WAIST',
      slotName: '벨트',
      itemId: 'b7062a0ba2ddd8dc5d8d481ae764c944',
      itemName: '때 묻지 않은 정화 벨트',
      rarity: '레전더리',
      exclusive: false,
      reinforce: { kind: 'reinforce', value: 0, amplificationName: null },
      enchant: {
        status: [
          { name: '힘', value: 75 },
          { name: '지능', value: 75 },
          { name: '체력', value: 75 },
          { name: '정신력', value: 75 }
        ],
        grade: '종결'
      }
    },
    {
      slotId: 'SHOES',
      slotName: '신발',
      itemId: '6f6202187264130623fb7386af92735f',
      itemName: '칠흑의 정화 신발',
      rarity: '에픽',
      exclusive: false,
      reinforce: { kind: 'reinforce', value: 0, amplificationName: null },
      enchant: {
        status: [
          { name: '힘', value: 75 },
          { name: '지능', value: 75 },
          { name: '체력', value: 75 },
          { name: '정신력', value: 75 }
        ],
        grade: '준종결'
      }
    },
    {
      slotId: 'AMULET',
      slotName: '목걸이',
      itemId: '0eb5d7cad40b1aeaad80c8997cc7fc99',
      itemName: '칠흑의 정화 목걸이',
      rarity: '에픽',
      exclusive: false,
      reinforce: { kind: 'amplify', value: 7, amplificationName: '차원의 지능' },
      enchant: {
        status: [
          { name: '힘', value: 60 },
          { name: '지능', value: 60 },
          { name: '체력', value: 60 },
          { name: '정신력', value: 60 }
        ],
        grade: '종결'
      }
    },
    {
      slotId: 'WRIST',
      slotName: '팔찌',
      itemId: '91b97030310791c815100f5749e96c94',
      itemName: '칠흑의 정화 팔찌',
      rarity: '에픽',
      exclusive: false,
      reinforce: { kind: 'amplify', value: 4, amplificationName: '차원의 지능' },
      enchant: {
        status: [
          { name: '힘', value: 60 },
          { name: '지능', value: 60 },
          { name: '체력', value: 60 },
          { name: '정신력', value: 60 }
        ],
        grade: null
      }
    },
    {
      slotId: 'RING',
      slotName: '반지',
      itemId: '854d52a64fe061dc2586a10bf274676b',
      itemName: '칠흑의 정화 반지',
      rarity: '에픽',
      exclusive: false,
      reinforce: { kind: 'amplify', value: 5, amplificationName: '차원의 지능' },
      enchant: {
        status: [
          { name: '힘', value: 60 },
          { name: '지능', value: 60 },
          { name: '체력', value: 60 },
          { name: '정신력', value: 60 }
        ],
        grade: '기타'
      }
    },
    {
      slotId: 'SUPPORT',
      slotName: '보조장비',
      itemId: 'b461b9224f434cb08ef98752eaf02f6b',
      itemName: '그을린 정화 보조장비',
      rarity: '유니크',
      exclusive: false,
      reinforce: { kind: 'amplify', value: 4, amplificationName: '차원의 지능' },
      enchant: {
        status: [
          { name: '힘', value: 90 },
          { name: '지능', value: 90 },
          { name: '체력', value: 90 },
          { name: '정신력', value: 90 }
        ],
        grade: '준종결'
      }
    },
    {
      slotId: 'MAGIC_STON',
      slotName: '마법석',
      itemId: '1ec42a6c4087627c396daa257475ed5c',
      itemName: '칠흑의 정화 마법석',
      rarity: '에픽',
      exclusive: false,
      reinforce: { kind: 'amplify', value: 7, amplificationName: '차원의 지능' },
      enchant: {
        status: [
          { name: '힘', value: 100 },
          { name: '지능', value: 100 },
          { name: '체력', value: 100 },
          { name: '정신력', value: 100 }
        ],
        grade: '종결'
      }
    },
    {
      slotId: 'EARRING',
      slotName: '귀걸이',
      itemId: '1817f0bc89bbcde471f1fbb5e50b6529',
      itemName: '타버린 정화 귀걸이',
      rarity: '레전더리',
      exclusive: false,
      reinforce: { kind: 'amplify', value: 7, amplificationName: '차원의 지능' },
      enchant: {
        status: [
          { name: '힘', value: 150 },
          { name: '지능', value: 150 },
          { name: '체력', value: 150 },
          { name: '정신력', value: 150 }
        ],
        grade: '기타'
      }
    }
  ]
}

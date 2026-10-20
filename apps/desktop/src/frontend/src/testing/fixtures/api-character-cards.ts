import type { CharacterCard } from '../../types/cards'

// Issue #716 계약 교차 확인용. API의 응답 fixture(apps/api/test/fixtures/character-card-dealer.json,
// character-card-buffer.json)의 `card`를 그대로 옮겼다. API는 점수 자리를 null로 두고 Desktop main이 채운다.

export const apiDealerCard: CharacterCard = {
  role: 'dealer',
  stats: {
    role: 'dealer',
    attackIncrease: 71104.5,
    amplification: 73,
    critical: 89.5,
    switchingLevel: null
  },
  score: null,
  serverRank: null,
  set: {
    setItemId: '4ee7bd5912cda6e2a24c1f36d5202b46',
    name: '로열 페어리 세트',
    rarityName: '태초',
    point: { current: 2615, min: 2550, max: 2550 },
    imageItemId: '11f55a9437e514d46ee55c8a8ae82b7e',
    slots: [
      { slotId: 'JACKET', rarity: '에픽' },
      { slotId: 'SHOULDER', rarity: '에픽' },
      { slotId: 'PANTS', rarity: '에픽' },
      { slotId: 'SHOES', rarity: '에픽' },
      { slotId: 'WAIST', rarity: '에픽' },
      { slotId: 'AMULET', rarity: '태초' },
      { slotId: 'WRIST', rarity: '태초' },
      { slotId: 'RING', rarity: '태초' },
      { slotId: 'SUPPORT', rarity: '에픽' },
      { slotId: 'MAGIC_STON', rarity: '에픽' },
      { slotId: 'EARRING', rarity: '에픽' }
    ],
    rarityCounts: [
      { rarity: '에픽', count: 8 },
      { rarity: '태초', count: 3 }
    ]
  },
  oath: {
    itemId: '97edf2846698bad4055330d5f7fe90b4',
    name: '세계를 태우는 용투 서약',
    rarity: '태초',
    point: 655,
    setName: '야망의 용투 서약',
    optionName: '용투 : 세계를 태우는 불꽃',
    setPoint: { current: 2780, min: 2550, max: 2550 },
    upgrades: [
      { step: 1, stepName: '<묵언의 진의> - 첫 번째 진의', optionName: '고요한 호흡' },
      { step: 2, stepName: '<묵언의 진의> - 두 번째 진의', optionName: '자애의 마음' },
      { step: 3, stepName: '<묵언의 진의> - 세 번째 진의', optionName: '내면의 조율' },
      { step: 4, stepName: '<묵언의 진의> - 네 번째 진의', optionName: '신념의 대가' },
      { step: 5, stepName: '<묵언의 진의> - 다섯 번째 진의', optionName: '이어진 걸음' },
      { step: 6, stepName: '<묵언의 진의> - 여섯 번째 진의', optionName: '영원의 궤적' },
      { step: 7, stepName: '<묵언의 진의> - 일곱 번째 진의', optionName: '만물의 흐름' },
      { step: 8, stepName: '<묵언의 진의> - 여덟 번째 진의', optionName: '순례자의 길' },
      { step: 9, stepName: '<묵언의 진의> - 아홉 번째 진의', optionName: '진리 도달' }
    ],
    crystals: [
      {
        slotNo: 0,
        itemId: '089e68a1c3a6103f1323dc51c231d6ab',
        name: '용투 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 195
      },
      {
        slotNo: 1,
        itemId: '089e68a1c3a6103f1323dc51c231d6ab',
        name: '용투 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 195
      },
      {
        slotNo: 2,
        itemId: '089e68a1c3a6103f1323dc51c231d6ab',
        name: '용투 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 195
      },
      {
        slotNo: 3,
        itemId: '089e68a1c3a6103f1323dc51c231d6ab',
        name: '용투 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 195
      },
      {
        slotNo: 4,
        itemId: '089e68a1c3a6103f1323dc51c231d6ab',
        name: '용투 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 195
      },
      {
        slotNo: 5,
        itemId: '089e68a1c3a6103f1323dc51c231d6ab',
        name: '용투 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 195
      },
      {
        slotNo: 6,
        itemId: '089e68a1c3a6103f1323dc51c231d6ab',
        name: '용투 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 175
      },
      {
        slotNo: 7,
        itemId: '089e68a1c3a6103f1323dc51c231d6ab',
        name: '용투 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 165
      },
      {
        slotNo: 8,
        itemId: '5573cd49fa3b6248104b8b1319ef5671',
        name: '용투 : 태초의 광휘 결정',
        rarity: '태초',
        setPoint: 205
      },
      {
        slotNo: 9,
        itemId: '5573cd49fa3b6248104b8b1319ef5671',
        name: '용투 : 태초의 광휘 결정',
        rarity: '태초',
        setPoint: 205
      },
      {
        slotNo: 10,
        itemId: '5573cd49fa3b6248104b8b1319ef5671',
        name: '용투 : 태초의 광휘 결정',
        rarity: '태초',
        setPoint: 205
      }
    ],
    rarityCounts: [
      { rarity: '에픽', count: 8 },
      { rarity: '태초', count: 3 }
    ]
  },
  investment: [
    {
      slotId: 'WEAPON',
      slotName: '무기',
      itemId: '89c42c1d02e6749244ce518e9b34e1c7',
      itemName: '재앙의 송곳니',
      rarity: '태초',
      reinforce: { kind: 'reinforce', value: 10, amplificationName: null },
      enchant: {
        status: [
          { name: '화속성강화', value: 15 },
          { name: '명속성강화', value: 15 }
        ],
        grade: null
      }
    },
    {
      slotId: 'JACKET',
      slotName: '상의',
      itemId: '11f55a9437e514d46ee55c8a8ae82b7e',
      itemName: '긍휼 속 자비의 상의',
      rarity: '에픽',
      reinforce: { kind: 'reinforce', value: 0, amplificationName: null },
      enchant: {
        status: [
          { name: '최종 데미지 증가', value: '1%' },
          { name: '물리 공격력', value: 110 },
          { name: '마법 공격력', value: 110 },
          { name: '독립 공격력', value: 110 },
          { name: '힘', value: 90 },
          { name: '지능', value: 90 }
        ],
        grade: null
      }
    },
    {
      slotId: 'SHOULDER',
      slotName: '머리어깨',
      itemId: '2d81feba3c9977d5ffa32fd378785bf0',
      itemName: '숭고한 심판의 어깨',
      rarity: '에픽',
      reinforce: { kind: 'reinforce', value: 0, amplificationName: null },
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
          { name: '최종 데미지 증가', value: '3%' }
        ],
        grade: '종결'
      }
    },
    {
      slotId: 'PANTS',
      slotName: '하의',
      itemId: '607ee0da46bf24a4b211bff52f3c05f1',
      itemName: '명예로운 공경의 하의',
      rarity: '에픽',
      reinforce: { kind: 'reinforce', value: 0, amplificationName: null },
      enchant: {
        status: [
          { name: '최종 데미지 증가', value: '1%' },
          { name: '물리 공격력', value: 110 },
          { name: '마법 공격력', value: 110 },
          { name: '독립 공격력', value: 110 },
          { name: '힘', value: 90 },
          { name: '지능', value: 90 }
        ],
        grade: null
      }
    },
    {
      slotId: 'WAIST',
      slotName: '벨트',
      itemId: '20c367fa5eaccbaa7b9fe372d4b94170',
      itemName: '완전한 침묵의 벨트',
      rarity: '에픽',
      reinforce: { kind: 'reinforce', value: 0, amplificationName: null },
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
        grade: '종결'
      }
    },
    {
      slotId: 'SHOES',
      slotName: '신발',
      itemId: 'e6360b073291b20bd81c830fe5b52962',
      itemName: '고요한 안식의 신발',
      rarity: '에픽',
      reinforce: { kind: 'reinforce', value: 0, amplificationName: null },
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
      itemId: 'f774b185f71d9f5e7a712aa842e8ebba',
      itemName: '성스러운 믿음의 목걸이',
      rarity: '태초',
      reinforce: { kind: 'reinforce', value: 0, amplificationName: null },
      enchant: {
        status: [
          { name: '모든 속성 강화', value: 35 },
          { name: '최종 데미지 증가', value: '1%' }
        ],
        grade: '종결'
      }
    },
    {
      slotId: 'WRIST',
      slotName: '팔찌',
      itemId: '1d102027205b181ec94bd03581f30fe6',
      itemName: '드러난 진실의 팔찌',
      rarity: '태초',
      reinforce: { kind: 'reinforce', value: 0, amplificationName: null },
      enchant: {
        status: [
          { name: '화속성강화', value: 35 },
          { name: '수속성강화', value: 35 }
        ],
        grade: null
      }
    },
    {
      slotId: 'RING',
      slotName: '반지',
      itemId: 'f8f5673ee549e8de296b3c2ba1593ca4',
      itemName: '거룩한 희생의 반지',
      rarity: '태초',
      reinforce: { kind: 'reinforce', value: 0, amplificationName: null },
      enchant: {
        status: [
          { name: '모든 속성 강화', value: 35 },
          { name: '최종 데미지 증가', value: '1%' }
        ],
        grade: '종결'
      }
    },
    {
      slotId: 'SUPPORT',
      slotName: '보조장비',
      itemId: '819d0bd846c913248d30c8b1e4e53755',
      itemName: '초연한 청렴의 보조장비',
      rarity: '에픽',
      reinforce: { kind: 'reinforce', value: 0, amplificationName: null },
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
      itemId: 'b797e5b10819d9edb772d6cc69f7561d',
      itemName: '무결한 순수의 마법석',
      rarity: '에픽',
      reinforce: { kind: 'reinforce', value: 0, amplificationName: null },
      enchant: { status: [{ name: '모든 속성 강화', value: 35 }], grade: '준종결' }
    },
    {
      slotId: 'EARRING',
      slotName: '귀걸이',
      itemId: '523be2dc115d046a3ce5ab76f5e1e42b',
      itemName: '강인한 절제의 귀걸이',
      rarity: '에픽',
      reinforce: { kind: 'amplify', value: 8, amplificationName: '차원의 힘' },
      enchant: {
        status: [
          { name: '모든 속성 강화', value: 15 },
          { name: '힘', value: 70 },
          { name: '지능', value: 70 },
          { name: '체력', value: 70 },
          { name: '정신력', value: 70 }
        ],
        grade: null
      }
    }
  ]
}

export const apiBufferCard: CharacterCard = {
  role: 'buffer',
  stats: {
    role: 'buffer',
    townStatName: '정신력',
    townStat: 7692,
    buff30: null,
    buff50: null,
    switchingLevel: null
  },
  score: null,
  serverRank: null,
  set: {
    setItemId: '93e7825053bdec4e0f4c12837cf4f57e',
    name: '환상의 에테리얼 오브 아츠 세트',
    rarityName: '태초',
    point: { current: 2550, min: 2550, max: 2550 },
    imageItemId: 'b18e7187087ec03a300e22d171e83ce4',
    slots: [
      { slotId: 'JACKET', rarity: '레전더리' },
      { slotId: 'SHOULDER', rarity: '레전더리' },
      { slotId: 'PANTS', rarity: '유니크' },
      { slotId: 'SHOES', rarity: '유니크' },
      { slotId: 'WAIST', rarity: '유니크' },
      { slotId: 'AMULET', rarity: '태초' },
      { slotId: 'WRIST', rarity: '에픽' },
      { slotId: 'RING', rarity: '유니크' },
      { slotId: 'SUPPORT', rarity: '레전더리' },
      { slotId: 'MAGIC_STON', rarity: '에픽' },
      { slotId: 'EARRING', rarity: '에픽' }
    ],
    rarityCounts: [
      { rarity: '레전더리', count: 3 },
      { rarity: '유니크', count: 4 },
      { rarity: '태초', count: 1 },
      { rarity: '에픽', count: 3 }
    ]
  },
  oath: {
    itemId: '316e1b0f26a3a471be2a95e33a315171',
    name: '영겁의 안개 서약',
    rarity: '에픽',
    point: 455,
    setName: '야망의 용투 서약',
    optionName: '용투 : 세계를 태우는 불꽃',
    setPoint: { current: 905, min: 830, max: 910 },
    upgrades: [],
    crystals: [
      {
        slotNo: 0,
        itemId: 'a4a263850a49401e8f174ce437596486',
        name: '용투 : 희미한 광휘 결정',
        rarity: '유니크',
        setPoint: 85
      },
      {
        slotNo: 1,
        itemId: 'a4a263850a49401e8f174ce437596486',
        name: '용투 : 희미한 광휘 결정',
        rarity: '유니크',
        setPoint: 85
      },
      {
        slotNo: 2,
        itemId: 'a4a263850a49401e8f174ce437596486',
        name: '용투 : 희미한 광휘 결정',
        rarity: '유니크',
        setPoint: 85
      },
      {
        slotNo: 3,
        itemId: 'a4a263850a49401e8f174ce437596486',
        name: '용투 : 희미한 광휘 결정',
        rarity: '유니크',
        setPoint: 85
      },
      {
        slotNo: 4,
        itemId: '089e68a1c3a6103f1323dc51c231d6ab',
        name: '용투 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 165
      },
      {
        slotNo: 5,
        itemId: '089e68a1c3a6103f1323dc51c231d6ab',
        name: '용투 : 완전한 광휘 결정',
        rarity: '에픽',
        setPoint: 165
      },
      {
        slotNo: 6,
        itemId: '6edbae57d1a6f5aa7838126874324906',
        name: '용투 : 선명한 광휘 결정',
        rarity: '레전더리',
        setPoint: 125
      },
      {
        slotNo: 7,
        itemId: 'a4a263850a49401e8f174ce437596486',
        name: '용투 : 희미한 광휘 결정',
        rarity: '유니크',
        setPoint: 85
      },
      {
        slotNo: 8,
        itemId: 'a4a263850a49401e8f174ce437596486',
        name: '용투 : 희미한 광휘 결정',
        rarity: '유니크',
        setPoint: 85
      },
      {
        slotNo: 9,
        itemId: 'a4a263850a49401e8f174ce437596486',
        name: '용투 : 희미한 광휘 결정',
        rarity: '유니크',
        setPoint: 85
      },
      {
        slotNo: 10,
        itemId: 'a4a263850a49401e8f174ce437596486',
        name: '용투 : 희미한 광휘 결정',
        rarity: '유니크',
        setPoint: 85
      }
    ],
    rarityCounts: [
      { rarity: '유니크', count: 8 },
      { rarity: '에픽', count: 2 },
      { rarity: '레전더리', count: 1 }
    ]
  },
  investment: [
    {
      slotId: 'WEAPON',
      slotName: '무기',
      itemId: '4c2c36b92f60155c579d36eea9786324',
      itemName: '시크릿 듀엣',
      rarity: '에픽',
      reinforce: { kind: 'reinforce', value: 0, amplificationName: null },
      enchant: {
        status: [
          { name: '힘', value: 110 },
          { name: '지능', value: 110 },
          { name: '체력', value: 110 },
          { name: '정신력', value: 110 },
          { name: '캐스트속도', value: '7%' }
        ],
        grade: '종결'
      }
    },
    {
      slotId: 'JACKET',
      slotName: '상의',
      itemId: 'b18e7187087ec03a300e22d171e83ce4',
      itemName: '수습 여우의 상의',
      rarity: '레전더리',
      reinforce: { kind: 'amplify', value: 0, amplificationName: '차원의 정신력' },
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
      slotId: 'SHOULDER',
      slotName: '머리어깨',
      itemId: '4e13a0e608282e52bfd188532a7bf8b4',
      itemName: '수습 여우의 보호 어깨',
      rarity: '레전더리',
      reinforce: { kind: 'amplify', value: 0, amplificationName: '차원의 정신력' },
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
      slotId: 'PANTS',
      slotName: '하의',
      itemId: 'cceec27707a6dbd029322483c679c124',
      itemName: '견습 여우의 그림자 하의',
      rarity: '유니크',
      reinforce: { kind: 'amplify', value: 0, amplificationName: '차원의 정신력' },
      enchant: {
        status: [
          { name: '힘', value: 125 },
          { name: '지능', value: 125 },
          { name: '체력', value: 125 },
          { name: '정신력', value: 125 }
        ],
        grade: null
      }
    },
    {
      slotId: 'WAIST',
      slotName: '벨트',
      itemId: '893d167b57f729204fb8278bf05d676f',
      itemName: '견습 여우의 비밀 벨트',
      rarity: '유니크',
      reinforce: { kind: 'amplify', value: 0, amplificationName: '차원의 정신력' },
      enchant: {
        status: [
          { name: '힘', value: 100 },
          { name: '지능', value: 100 },
          { name: '체력', value: 100 },
          { name: '정신력', value: 100 },
          { name: '물리 크리티컬 히트', value: '7%' },
          { name: '마법 크리티컬 히트', value: '7%' }
        ],
        grade: '종결'
      }
    },
    {
      slotId: 'SHOES',
      slotName: '신발',
      itemId: '78e3c4947c76867534ce0b2241093809',
      itemName: '견습 여우의 은빛 신발',
      rarity: '유니크',
      reinforce: { kind: 'amplify', value: 0, amplificationName: '차원의 정신력' },
      enchant: {
        status: [
          { name: '힘', value: 100 },
          { name: '지능', value: 100 },
          { name: '체력', value: 100 },
          { name: '정신력', value: 100 }
        ],
        grade: '준종결'
      }
    },
    {
      slotId: 'AMULET',
      slotName: '목걸이',
      itemId: 'e468101e457344d9824a0f1588152f06',
      itemName: '대 여우의 영혼 목걸이',
      rarity: '태초',
      reinforce: { kind: 'amplify', value: 0, amplificationName: '차원의 정신력' },
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
      slotId: 'WRIST',
      slotName: '팔찌',
      itemId: '463cc16ca330c26a15caba314d2c1a5c',
      itemName: '고유 - 모독자의 조소 팔찌',
      rarity: '에픽',
      reinforce: { kind: 'amplify', value: 0, amplificationName: '차원의 정신력' },
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
      slotId: 'RING',
      slotName: '반지',
      itemId: '40249d82eafb0137b0e081a94c40785d',
      itemName: '견습 여우의 매혹 반지',
      rarity: '유니크',
      reinforce: { kind: 'amplify', value: 0, amplificationName: '차원의 정신력' },
      enchant: {
        status: [
          { name: '힘', value: 90 },
          { name: '지능', value: 90 },
          { name: '체력', value: 90 },
          { name: '정신력', value: 90 }
        ],
        grade: '종결'
      }
    },
    {
      slotId: 'SUPPORT',
      slotName: '보조장비',
      itemId: 'dd267f29006748266a62a816b5b05d48',
      itemName: '수습 여우의 숨결 부적 보조장비',
      rarity: '레전더리',
      reinforce: { kind: 'amplify', value: 6, amplificationName: '차원의 정신력' },
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
      slotId: 'MAGIC_STON',
      slotName: '마법석',
      itemId: '9623d7f5197b40a96dffd78c65d57287',
      itemName: '고위 여우의 구슬 마법석',
      rarity: '에픽',
      reinforce: { kind: 'amplify', value: 3, amplificationName: '차원의 정신력' },
      enchant: {
        status: [
          { name: '힘', value: 100 },
          { name: '지능', value: 100 },
          { name: '체력', value: 100 },
          { name: '정신력', value: 100 }
        ],
        grade: '준종결'
      }
    },
    {
      slotId: 'EARRING',
      slotName: '귀걸이',
      itemId: '3c72626a0afb037b8b2b1f226eca6176',
      itemName: '고위 여우의 속삭임 귀걸이',
      rarity: '에픽',
      reinforce: { kind: 'amplify', value: 2, amplificationName: '차원의 정신력' },
      enchant: {
        status: [
          { name: '힘', value: 175 },
          { name: '지능', value: 175 },
          { name: '체력', value: 175 },
          { name: '정신력', value: 175 }
        ],
        grade: null
      }
    }
  ]
}

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  enchantGrades,
  gradeEnchant,
  parseEnchantGradeTable
} from '../src/characters/card/enchant-grades.js'
import { exclusiveItems, parseExclusiveItemTable } from '../src/characters/card/exclusive-items.js'
import { projectCharacterCard } from '../src/characters/card/project.js'
import type { CharacterCardSource } from '../src/characters/card/project.js'
import type { CharacterCard, CharacterServerRank } from '../src/characters/card/types.js'
import { projectCharacterDetails } from '../src/characters/details/project.js'
import type {
  CharacterDetailSection,
  CharacterSectionResponse
} from '../src/characters/details/sections.js'

const titles = {
  fixture: '실응답 fixture의 딜러와 버퍼는 세 면의 값을 모두 채우고 섹션 원문에서 읽은 값과 맞는다',
  role: '역할은 眞 접두를 포함한 버퍼 전직명으로 정하고 직업을 모르면 스탯도 null이다',
  townStat:
    '버퍼 주 스탯은 뮤즈, 패러메딕 정신력, 남자 크루세이더 정신력과 체력 중 큰 쪽, 그 밖은 지능이다',
  critical: '크리티컬은 숫자와 % 문자열을 받아 물리, 마법 중 큰 값이며 그 밖의 값은 null이다',
  set: '세트는 slotInfo가 가장 많은 항목이고 같으면 앞의 것이며 그림은 그 세트의 첫 장착 아이템이다',
  oath: '서약이 없으면 null이고 oathUpgrade가 없으면 묵언의 진의는 빈 목록이다',
  investment: '기타 면은 12부위 고정 순서로 증폭과 강화를 구분하고 빈 슬롯은 아이템 값이 null이다',
  enchant: '마법부여 등급은 표의 모든 옵션 이름, 값이 같을 때만 정하고 없으면 null이다',
  table: '등급표 형식이 틀리면 시작할 때 거절하고 저장소의 표는 같은 형식이다',
  exclusive:
    '유일 장비는 기준표의 부위와 이름이 모두 같을 때만 표시하고 세트 희귀도 개수에서는 유일로 센다',
  exclusiveTable: '유일 장비 기준표 형식이 틀리면 시작할 때 거절하고 저장소의 표는 같은 형식이다'
}

const emptyGrades = parseEnchantGradeTable({
  version: 1,
  source: { dataset: 'fixture', generated_at: null },
  slots: {}
})
const exclusiveTable = parseExclusiveItemTable({
  version: 1,
  source: { guide: 'fixture', checked_at: '2026-10-20' },
  slots: { RING: ['유일 반지'] }
})
const rank: CharacterServerRank = {
  rank: 3,
  total: 12,
  basis: 'fame',
  scope: 'stored',
  observedAt: '2026-10-19T00:00:00.000Z'
}

function source(overrides: Partial<CharacterCardSource> = {}): CharacterCardSource {
  return {
    character: { jobGrowName: '眞 이단심판관' },
    status: { status: [] },
    equipment: { equipment: [], setItemInfo: [] },
    oath: null,
    ...overrides
  }
}

function readFixture(role: 'dealer' | 'buffer') {
  const url = new URL(`../../test/fixtures/character-card-${role}.json`, import.meta.url)

  return JSON.parse(readFileSync(url, 'utf8')) as {
    sections: Record<CharacterDetailSection, Record<string, unknown>>
    items: Record<string, unknown>
    card: CharacterCard
  }
}

test(titles.fixture, () => {
  for (const role of ['dealer', 'buffer'] as const) {
    const fixture = readFixture(role)
    const { serverId, characterId } = fixture.sections.basic as Record<string, string>
    const identity = { serverId: serverId!, characterId: characterId! }
    const at = new Date('2026-10-19T00:00:00.000Z')
    const rows = Object.entries(fixture.sections).map(
      ([section, payload]): CharacterSectionResponse => ({
        section: section as CharacterDetailSection,
        payload,
        revision: 1,
        contentUpdatedAt: at,
        lastSuccessfulFetchAt: at
      })
    )

    const card = projectCharacterCard(
      projectCharacterDetails(identity, rows),
      null,
      enchantGrades,
      exclusiveItems
    )

    assert.deepEqual(card, fixture.card, role)
    assert.equal(card.role, role)
    assert(card.stats, role)
    const statValues = Object.entries(card.stats).filter(
      ([key]) => !['role', 'townStatName', 'switchingLevel', 'buff30', 'buff50'].includes(key)
    )
    assert(
      statValues.every(([, value]) => typeof value === 'number'),
      role
    )
    assert(card.set && card.set.slots.length > 0 && card.set.point && card.set.imageItemId, role)
    assert(card.oath && card.oath.crystals.length > 0 && card.oath.setPoint, role)
    assert.equal(card.investment.length, 12)
    assert(
      card.investment.every((row) => row.itemId && row.reinforce && row.enchant),
      role
    )
  }
  // The stored card must also agree with values read directly from the provider sections.
  const dealerFixture = readFixture('dealer')
  const status = new Map(
    (dealerFixture.sections.status.status as { name: string; value: number }[]).map((s) => [
      s.name,
      s.value
    ])
  )
  assert.deepEqual(dealerFixture.card.stats, {
    role: 'dealer',
    attackIncrease: status.get('공격력 증가'),
    amplification: status.get('공격력 증폭'),
    critical: Math.max(status.get('물리 크리티컬')!, status.get('마법 크리티컬')!),
    switchingLevel: null
  })
  // 실응답 버퍼는 뮤즈라 지능이 아니라 정신력을 원문 능력치에서 그대로 옮긴다.
  const bufferFixture = readFixture('buffer')
  const bufferStatus = new Map(
    (bufferFixture.sections.status.status as { name: string; value: number }[]).map((s) => [
      s.name,
      s.value
    ])
  )
  assert.equal(bufferFixture.sections.basic.jobGrowName, '眞 뮤즈')
  assert.deepEqual(bufferFixture.card.stats, {
    role: 'buffer',
    townStatName: '정신력',
    townStat: bufferStatus.get('정신력'),
    buff30: null,
    buff50: null,
    switchingLevel: null
  })
  const [equippedSet] = dealerFixture.sections.equipment.setItemInfo as {
    setItemId: string
    active: { setPoint: { current: number; min: number; max: number } }
    slotInfo: unknown[]
  }[]
  assert.equal(dealerFixture.card.set?.setItemId, equippedSet!.setItemId)
  assert.equal(dealerFixture.card.set?.slots.length, equippedSet!.slotInfo.length)
  assert.equal(dealerFixture.card.set?.point?.current, equippedSet!.active.setPoint.current)
  const oath = dealerFixture.sections.oath.oath as {
    info: { setPoint: number; oathUpgrade: { options: unknown[] } }
    crystal: unknown[]
  }
  assert.equal(dealerFixture.card.oath?.point, oath.info.setPoint)
  assert.equal(dealerFixture.card.oath?.crystals.length, oath.crystal.length)
  const earring = (dealerFixture.sections.equipment.equipment as Record<string, unknown>[]).find(
    (item) => item.slotId === 'EARRING'
  )
  assert.deepEqual(dealerFixture.card.investment.at(-1)?.reinforce, {
    kind: 'amplify',
    value: earring?.reinforce,
    amplificationName: earring?.amplificationName
  })
  const dealer = dealerFixture.card
  assert.equal(dealer.oath?.upgrades.length, oath.info.oathUpgrade.options.length)
  assert.equal(dealer.oath?.upgrades.length, 9)
  assert(dealer.investment.some((row) => row.reinforce?.kind === 'amplify'))
  assert(dealer.investment.some((row) => row.reinforce?.kind === 'reinforce'))
  assert.deepEqual(readFixture('buffer').card.oath?.upgrades, [])
})

test(titles.role, () => {
  for (const [jobGrowName, role] of [
    ['眞 크루세이더', 'buffer'],
    ['眞 인챈트리스', 'buffer'],
    ['眞 패러메딕', 'buffer'],
    ['眞 뮤즈', 'buffer'],
    ['뮤즈', 'buffer'],
    ['眞 이단심판관', 'dealer'],
    ['眞 뮤즈 아님', 'dealer']
  ] as const) {
    const card = projectCharacterCard(
      source({ character: { jobGrowName } }),
      null,
      emptyGrades,
      exclusiveTable
    )
    assert.equal(card.role, role, jobGrowName)
    assert.equal(card.stats?.role, role, jobGrowName)
  }
  const buffer = projectCharacterCard(
    source({
      character: { jobGrowName: '眞 뮤즈' },
      status: { status: [{ name: '정신력', value: 7692 }] }
    }),
    rank,
    emptyGrades,
    exclusiveTable
  )
  assert.deepEqual(buffer.stats, {
    role: 'buffer',
    townStatName: '정신력',
    townStat: 7692,
    buff30: null,
    buff50: null,
    switchingLevel: null
  })
  assert.equal(buffer.score, null)
  assert.deepEqual(buffer.serverRank, rank)
  for (const jobGrowName of [null, '', 42, undefined]) {
    const card = projectCharacterCard(
      source({ character: { jobGrowName } }),
      null,
      emptyGrades,
      exclusiveTable
    )
    assert.equal(card.role, null)
    assert.equal(card.stats, null)
  }
})

test(titles.townStat, () => {
  const status = (spirit: number | null, vitality: number | null) => [
    { name: '지능', value: 5000 },
    ...(spirit === null ? [] : [{ name: '정신력', value: spirit }]),
    ...(vitality === null ? [] : [{ name: '체력', value: vitality }])
  ]
  const townStat = (
    jobName: string,
    jobGrowName: string,
    spirit: number | null,
    vitality: number | null
  ) => {
    const card = projectCharacterCard(
      source({ character: { jobName, jobGrowName }, status: { status: status(spirit, vitality) } }),
      null,
      emptyGrades,
      exclusiveTable
    )
    if (card.stats?.role !== 'buffer') {
      assert.fail('버퍼 스탯이 아닙니다.')
    }

    return [card.stats.townStatName, card.stats.townStat]
  }
  assert.deepEqual(townStat('아처', '眞 뮤즈', 7692, 9000), ['정신력', 7692])
  assert.deepEqual(townStat('거너(여)', '眞 패러메딕', 7000, 9000), ['정신력', 7000])
  assert.deepEqual(townStat('마법사(여)', '眞 인챈트리스', 7000, 9000), ['지능', 5000])
  assert.deepEqual(townStat('프리스트(여)', '眞 크루세이더', 7000, 9000), ['지능', 5000])
  // 남자 크루세이더는 정신력과 체력 중 큰 쪽이고, 같거나 체력을 모르면 정신력이다.
  assert.deepEqual(townStat('프리스트(남)', '眞 크루세이더', 7000, 9000), ['체력', 9000])
  assert.deepEqual(townStat('프리스트(남)', '眞 크루세이더', 9000, 7000), ['정신력', 9000])
  assert.deepEqual(townStat('프리스트(남)', '크루세이더', 7000, 7000), ['정신력', 7000])
  assert.deepEqual(townStat('프리스트(남)', '眞 크루세이더', 7000, null), ['정신력', 7000])
  assert.deepEqual(townStat('프리스트(남)', '眞 크루세이더', null, 9000), ['체력', 9000])
  assert.deepEqual(townStat('프리스트(남)', '眞 크루세이더', null, null), ['정신력', null])
})

test(titles.critical, () => {
  const stats = (status: unknown[]) =>
    projectCharacterCard(source({ status: { status } }), null, emptyGrades, exclusiveTable).stats
  const critical = (physical: unknown, magical: unknown) => {
    const dealer = stats([
      { name: '물리 크리티컬', value: physical },
      { name: '마법 크리티컬', value: magical }
    ])
    assert.equal(dealer?.role, 'dealer')

    return dealer.critical
  }

  assert.deepEqual(
    stats([
      { name: '공격력 증가', value: 63790.5 },
      { name: '공격력 증폭', value: '31%' },
      { name: '물리 크리티컬', value: 117.5 },
      { name: '마법 크리티컬', value: '97.5%' }
    ]),
    {
      role: 'dealer',
      attackIncrease: 63790.5,
      amplification: 31,
      critical: 117.5,
      switchingLevel: null
    }
  )
  assert.equal(critical('48.3%', 12), 48.3)
  assert.equal(critical('unknown', '97.5%'), 97.5)
  assert.equal(critical(null, 66.5), 66.5)
  assert.equal(critical(Number.NaN, ''), null)
  assert.deepEqual(
    stats([
      { name: '공격력 증가', value: '1,000' },
      { name: '공격력 증폭', value: { value: 31 } }
    ]),
    {
      role: 'dealer',
      attackIncrease: null,
      amplification: null,
      critical: null,
      switchingLevel: null
    }
  )
})

test(titles.set, () => {
  const set = (setItemId: string, slots: string[], extra: Record<string, unknown> = {}) => ({
    setItemId,
    setItemName: `${setItemId} 세트`,
    setItemRarityName: '태초',
    active: { setPoint: { current: 2615, min: 2550, max: 2550, adjustedPoint: 0 } },
    slotInfo: slots.map((slotId) => ({ slotId, itemRarity: slotId === 'RING' ? '태초' : '에픽' })),
    ...extra
  })
  const equipment = [
    { slotId: 'WEAPON', itemId: 'weapon', setItemId: null },
    { slotId: 'JACKET', itemId: 'jacket', setItemId: 'major' },
    { slotId: 'RING', itemId: 'ring', setItemId: 'major' }
  ]
  const project = (setItemInfo: unknown) =>
    projectCharacterCard(
      source({ equipment: { equipment, setItemInfo } }),
      null,
      emptyGrades,
      exclusiveTable
    ).set

  assert.deepEqual(project([set('minor', ['WEAPON']), set('major', ['JACKET', 'RING', 'PANTS'])]), {
    setItemId: 'major',
    name: 'major 세트',
    rarityName: '태초',
    point: { current: 2615, min: 2550, max: 2550 },
    imageItemId: 'jacket',
    slots: [
      { slotId: 'JACKET', rarity: '에픽', exclusive: false },
      { slotId: 'RING', rarity: '태초', exclusive: false },
      { slotId: 'PANTS', rarity: '에픽', exclusive: false }
    ],
    rarityCounts: [
      { rarity: '에픽', count: 2 },
      { rarity: '태초', count: 1 }
    ]
  })
  const tied = project([set('first', ['WEAPON']), set('second', ['JACKET'])])
  assert.equal(tied?.setItemId, 'first')
  assert.equal(tied?.imageItemId, null)
  const inactive = project([set('major', ['JACKET'], { active: null, setItemRarityName: '' })])
  assert.equal(inactive?.point, null)
  assert.equal(inactive?.rarityName, null)
  assert.equal(project([]), null)
  assert.equal(project(null), null)
})

test(titles.oath, () => {
  const info = {
    itemId: 'oath',
    itemName: '서약',
    itemRarity: '태초',
    setPoint: 655,
    oathUpgrade: null
  }
  const project = (oath: unknown) =>
    projectCharacterCard(source({ oath }), null, emptyGrades, exclusiveTable).oath

  assert.equal(project(null), null)
  assert.equal(project({ info: null, crystal: [], setInfo: null }), null)
  assert.deepEqual(project({ info, crystal: null, setInfo: null }), {
    itemId: 'oath',
    name: '서약',
    rarity: '태초',
    point: 655,
    setName: null,
    optionName: null,
    setPoint: null,
    upgrades: [],
    crystals: [],
    rarityCounts: []
  })
  const upgraded = project({
    info: {
      ...info,
      oathUpgrade: {
        options: [
          { stepName: '<묵언의 진의> - 첫 번째 진의', optionName: '고요한 호흡', status: [] },
          { stepName: '<묵언의 진의> - 두 번째 진의', optionName: '자애의 마음', status: [] }
        ]
      }
    },
    crystal: [
      {
        slotNo: 0,
        itemId: 'crystal',
        itemName: '결정',
        itemRarity: '에픽',
        tune: { setPoint: 195 }
      },
      { slotNo: 1, itemId: 'crystal', itemName: '결정', itemRarity: '에픽', tune: null },
      { slotNo: 2, itemId: 'primal', itemName: '태초 결정', itemRarity: '태초' }
    ],
    setInfo: {
      setName: '야망의 용투 서약',
      setOptionName: '용투 : 세계를 태우는 불꽃',
      active: { setPoint: { current: 2780, min: 2550, max: 2550 } }
    }
  })
  assert.deepEqual(upgraded?.upgrades, [
    { step: 1, stepName: '<묵언의 진의> - 첫 번째 진의', optionName: '고요한 호흡' },
    { step: 2, stepName: '<묵언의 진의> - 두 번째 진의', optionName: '자애의 마음' }
  ])
  assert.deepEqual(
    upgraded?.crystals.map((crystal) => crystal.setPoint),
    [195, null, null]
  )
  assert.deepEqual(upgraded?.rarityCounts, [
    { rarity: '에픽', count: 2 },
    { rarity: '태초', count: 1 }
  ])
  assert.equal(upgraded?.setName, '야망의 용투 서약')
  assert.deepEqual(upgraded?.setPoint, { current: 2780, min: 2550, max: 2550 })
})

test(titles.investment, () => {
  const card = projectCharacterCard(
    source({
      equipment: {
        setItemInfo: [],
        equipment: [
          { slotId: 'TITLE', itemId: 'title', reinforce: 0 },
          {
            slotId: 'EARRING',
            slotName: '귀걸이',
            itemId: 'earring',
            itemName: '귀걸이',
            itemRarity: '태초',
            reinforce: 8,
            amplificationName: '차원의 힘',
            enchant: { status: [{ name: '모든 속성 강화', value: 11 }] }
          },
          {
            slotId: 'WEAPON',
            itemId: 'weapon',
            itemName: '무기',
            itemRarity: '에픽',
            reinforce: 10,
            amplificationName: null,
            enchant: { reinforceSkill: [{ jobId: 'job', skills: [] }] }
          },
          { slotId: 'RING', itemId: 'ring', reinforce: '12', enchant: null }
        ]
      }
    }),
    null,
    emptyGrades,
    exclusiveTable
  )

  assert.deepEqual(
    card.investment.map((row) => row.slotId),
    [
      'WEAPON',
      'JACKET',
      'SHOULDER',
      'PANTS',
      'WAIST',
      'SHOES',
      'AMULET',
      'WRIST',
      'RING',
      'SUPPORT',
      'MAGIC_STON',
      'EARRING'
    ]
  )
  const row = (slotId: string) => card.investment.find((item) => item.slotId === slotId)
  assert.deepEqual(row('WEAPON'), {
    slotId: 'WEAPON',
    slotName: '무기',
    itemId: 'weapon',
    itemName: '무기',
    rarity: '에픽',
    exclusive: false,
    reinforce: { kind: 'reinforce', value: 10, amplificationName: null },
    enchant: { status: [], grade: null }
  })
  assert.deepEqual(row('EARRING')?.reinforce, {
    kind: 'amplify',
    value: 8,
    amplificationName: '차원의 힘'
  })
  assert.deepEqual(row('EARRING')?.enchant, {
    status: [{ name: '모든 속성 강화', value: 11 }],
    grade: null
  })
  assert.equal(row('RING')?.reinforce, null)
  assert.equal(row('RING')?.enchant, null)
  assert.deepEqual(row('JACKET'), {
    slotId: 'JACKET',
    slotName: '상의',
    itemId: null,
    itemName: null,
    rarity: null,
    exclusive: false,
    reinforce: null,
    enchant: null
  })
})

test(titles.enchant, () => {
  const grades = parseEnchantGradeTable({
    version: 1,
    source: { dataset: 'fixture', generated_at: '2026-10-19T00:00:00Z' },
    slots: {
      WEAPON: {
        종결: [
          {
            cardNames: ['종결 카드', '같은 옵션의 다른 카드'],
            status: [
              { name: '암속성강화', value: 13 },
              { name: '공격력', value: '3%' }
            ]
          }
        ],
        준종결: [
          { status: [{ name: '암속성강화', value: 13 }] },
          { status: [{ name: '힘', value: 30 }] }
        ],
        기타: [{ status: [{ name: '힘', value: 30 }] }]
      }
    }
  })

  assert.equal(
    gradeEnchant(grades, 'WEAPON', [
      { name: '공격력', value: '3%' },
      { name: '암속성강화', value: 13 }
    ]),
    '종결'
  )
  assert.equal(gradeEnchant(grades, 'WEAPON', [{ name: '암속성강화', value: 13 }]), '준종결')
  assert.equal(gradeEnchant(grades, 'WEAPON', [{ name: '힘', value: 30 }]), '준종결')
  assert.equal(gradeEnchant(grades, 'WEAPON', [{ name: '암속성강화', value: '13' }]), null)
  assert.equal(
    gradeEnchant(grades, 'WEAPON', [
      { name: '암속성강화', value: 13 },
      { name: '힘', value: 20 }
    ]),
    null
  )
  assert.equal(gradeEnchant(grades, 'WEAPON', []), null)
  assert.equal(gradeEnchant(grades, 'JACKET', [{ name: '암속성강화', value: 13 }]), null)

  const card = projectCharacterCard(
    source({
      equipment: {
        setItemInfo: [],
        equipment: [
          {
            slotId: 'WEAPON',
            itemId: 'weapon',
            reinforce: 0,
            enchant: { status: [{ name: '암속성강화', value: 13 }] }
          }
        ]
      }
    }),
    null,
    grades,
    exclusiveTable
  )
  assert.equal(card.investment[0]?.enchant?.grade, '준종결')
})

test(titles.table, () => {
  const valid = { version: 1, source: { dataset: 'fixture', generated_at: null }, slots: {} }
  for (const invalid of [
    null,
    { ...valid, version: 2 },
    { ...valid, source: { dataset: 'fixture' } },
    { ...valid, slots: { WEAPON: { 최고: [] } } },
    { ...valid, slots: { WEAPON: { 종결: [{ status: [] }] } } },
    { ...valid, slots: { WEAPON: { 종결: [{ status: [{ name: '', value: 13 }] }] } } },
    { ...valid, slots: { WEAPON: { 종결: [{ status: [{ name: '힘', value: null }] }] } } },
    {
      ...valid,
      slots: { WEAPON: { 종결: [{ status: [{ name: '힘', value: 1 }], cardNames: 1 }] } }
    },
    {
      ...valid,
      slots: { WEAPON: { 종결: [{ status: [{ name: '힘', value: 1 }], cardNames: [] }] } }
    },
    {
      ...valid,
      slots: { WEAPON: { 종결: [{ status: [{ name: '힘', value: 1 }], cardNames: [''] }] } }
    },
    {
      ...valid,
      slots: { WEAPON: { 종결: [{ status: [{ name: '힘', value: 1 }], cardNames: [1] }] } }
    }
  ]) {
    assert.throws(() => parseEnchantGradeTable(invalid), /Invalid enchant grade table/)
  }
  assert.deepEqual(parseEnchantGradeTable(valid), valid)
  assert.equal(enchantGrades.version, 1)
})

test(titles.exclusive, () => {
  const equipment = [
    { slotId: 'RING', itemId: 'ring', itemName: '유일 반지', itemRarity: '태초', setItemId: null },
    { slotId: 'SUPPORT', itemId: 'support', itemName: '유일 반지', itemRarity: '태초' },
    { slotId: 'AMULET', itemId: 'amulet', itemName: '목걸이', itemRarity: '태초' }
  ]
  const setItemInfo = [
    {
      setItemId: 'set',
      setItemName: '세트',
      slotInfo: ['RING', 'SUPPORT', 'AMULET'].map((slotId) => ({ slotId, itemRarity: '태초' }))
    }
  ]
  const card = projectCharacterCard(
    source({ equipment: { equipment, setItemInfo } }),
    null,
    emptyGrades,
    exclusiveTable
  )

  const exclusive = (slotId: string) =>
    card.investment.find((row) => row.slotId === slotId)?.exclusive
  assert.equal(exclusive('RING'), true)
  // The same name in a slot the table does not list is not a 유일 장비.
  assert.equal(exclusive('SUPPORT'), false)
  assert.equal(exclusive('AMULET'), false)
  assert.equal(exclusive('WEAPON'), false)
  assert.deepEqual(card.set?.slots, [
    { slotId: 'RING', rarity: '태초', exclusive: true },
    { slotId: 'SUPPORT', rarity: '태초', exclusive: false },
    { slotId: 'AMULET', rarity: '태초', exclusive: false }
  ])
  assert.deepEqual(card.set?.rarityCounts, [
    { rarity: '유일', count: 1 },
    { rarity: '태초', count: 2 }
  ])
})

test(titles.exclusiveTable, () => {
  const valid = { version: 1, source: { guide: 'fixture', checked_at: '2026-10-20' }, slots: {} }
  for (const invalid of [
    null,
    { ...valid, version: 2 },
    { ...valid, source: { guide: 'fixture' } },
    { ...valid, slots: null },
    { ...valid, slots: { RING: [] } },
    { ...valid, slots: { RING: [''] } },
    { ...valid, slots: { RING: '유일 반지' } }
  ]) {
    assert.throws(() => parseExclusiveItemTable(invalid), /Invalid exclusive item table/)
  }
  assert.deepEqual(parseExclusiveItemTable(valid), valid)
  assert.deepEqual(Object.keys(exclusiveItems.slots).sort(), [
    'EARRING',
    'MAGIC_STON',
    'RING',
    'SUPPORT'
  ])
})

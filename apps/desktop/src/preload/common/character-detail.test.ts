import { expect, it } from 'vitest'
import apiBufferFixture from '../../../../api/test/fixtures/character-card-buffer.json'
import apiDealerFixture from '../../../../api/test/fixtures/character-card-dealer.json'
import {
  CHARACTER_DETAIL_ITEM_TEXT_MAX_LENGTH,
  isCharacterDetailCard,
  parseCharacterDetailSnapshot
} from './character-detail'
import {
  CHARACTER_SERVER_NAMES,
  characterCardSchema,
  characterImageUrl,
  characterSummarySchema
} from './search/character-summary'
import type { CharacterCard } from './types/character'
import type { CharacterDetailSnapshot } from './types/character-detail'

// API 응답 fixture의 카드에 main이 채우는 점수와 API가 세는 서버 순위를 더한 값이다.
const dealerCard = {
  ...apiDealerFixture.card,
  score: {
    calculator: 'equipment',
    value: 414806,
    skipped: null,
    versions: { package: '0.1.0', rulesRev: 'r1', bundleId: 'bundle-1' }
  },
  serverRank: {
    rank: 18240,
    total: 120000,
    basis: 'fame',
    scope: 'stored',
    observedAt: '2026-10-07T00:00:00.000Z'
  }
} as CharacterCard
const bufferCard = apiBufferFixture.card as CharacterCard

const snapshot: CharacterDetailSnapshot = {
  character: {
    serverId: 'cain',
    characterId: 'id_-123',
    characterName: '가나',
    serverName: '카인',
    adventureName: null,
    jobName: null,
    jobGrowName: null,
    level: null,
    fame: 0,
    imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/id_-123?zoom=1',
    guildName: null
  },
  card: null,
  itemTexts: {},
  skills: null,
  freshness: {
    lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z',
    expiresAt: '2026-10-07T00:05:00.000Z'
  }
}

it.each(Object.entries(CHARACTER_SERVER_NAMES))(
  '%s 서버와 고정 이미지 URL의 공통 계약을 유지한다',
  (serverId, serverName) => {
    const character = { ...snapshot.character, serverId, serverName }
    const imageUrl = characterImageUrl(character)
    const value = { ...snapshot, character: { ...character, imageUrl } }
    const { guildName: _, ...summary } = value.character
    expect(characterSummarySchema.parse(summary)).toEqual(summary)
    expect(parseCharacterDetailSnapshot(value)).toEqual(value)
  }
)

it.each([
  { serverId: 'unknown' },
  { serverName: '잘못된서버' },
  { characterId: '../escape' },
  { characterId: '' },
  { characterId: 'a'.repeat(257) },
  { characterName: ' ' },
  {
    imageUrl: 'https://img-api.neople.co.kr.evil.example/df/servers/cain/characters/id_-123?zoom=1'
  },
  { imageUrl: snapshot.character.imageUrl + '&extra=1' },
  { level: Infinity },
  { fame: '10' },
  { adventureName: {} },
  { guildName: 7 },
  { privateData: 'unexpected' }
])('잘못된 캐릭터 필드 %j는 거부한다', (patch) => {
  expect(() =>
    parseCharacterDetailSnapshot({ ...snapshot, character: { ...snapshot.character, ...patch } })
  ).toThrow('CHARACTER_DETAIL_UNAVAILABLE')
})

it.each([
  '2026-02-30T00:00:00Z',
  '2026-10-07T24:00:00Z',
  'private-date',
  '2026-10-07T00:00:00+09:00'
])('잘못된 UTC 시각 %s는 거부한다', (expiresAt) => {
  expect(() =>
    parseCharacterDetailSnapshot({ ...snapshot, freshness: { ...snapshot.freshness, expiresAt } })
  ).toThrow('CHARACTER_DETAIL_UNAVAILABLE')
})

it('추가 필드와 symbol을 거부하고 읽은 객체는 복사한다', () => {
  expect(() => parseCharacterDetailSnapshot({ ...snapshot, extra: true })).toThrow()
  expect(() =>
    parseCharacterDetailSnapshot({ ...snapshot, freshness: { ...snapshot.freshness, extra: true } })
  ).toThrow()
  expect(() => parseCharacterDetailSnapshot({ ...snapshot, [Symbol('extra')]: true })).toThrow()
  const parsed = parseCharacterDetailSnapshot(snapshot)
  expect(parsed).toEqual(snapshot)
  expect(parsed.character).not.toBe(snapshot.character)
  expect(parsed.freshness).not.toBe(snapshot.freshness)
})

it.each([
  ['딜러', dealerCard],
  ['버퍼', bufferCard]
])('%s 카드 값은 일반 preload의 카드 스키마와 같이 받고 복사해 넘긴다', (_, card) => {
  expect(characterCardSchema.safeParse(card).success).toBe(true)
  const parsed = parseCharacterDetailSnapshot({ ...snapshot, card })

  expect(parsed.card).toEqual(card)
  expect(parsed.card).not.toBe(card)
})

const [firstInvestment] = dealerCard.investment
const invalidCards: [string, unknown][] = [
  ['추가 필드', { ...dealerCard, privateData: true }],
  ['빠진 필드', { ...dealerCard, investment: undefined }],
  ['모르는 역할', { ...dealerCard, role: 'tank' }],
  ['역할과 맞지 않는 스탯', { ...dealerCard, stats: { ...bufferCard.stats, role: 'dealer' } }],
  ['유한하지 않은 점수', { ...dealerCard, score: { ...dealerCard.score, value: Infinity } }],
  ['0위 서버 순위', { ...dealerCard, serverRank: { ...dealerCard.serverRank, rank: 0 } }],
  [
    '날짜가 아닌 순위 시각',
    { ...dealerCard, serverRank: { ...dealerCard.serverRank, observedAt: 'yesterday' } }
  ],
  ['빈 세트 이름', { ...dealerCard, set: { ...dealerCard.set, name: ' ' } }],
  [
    '음수 강화',
    {
      ...dealerCard,
      investment: [{ ...firstInvestment, reinforce: { ...firstInvestment.reinforce, value: -1 } }]
    }
  ],
  [
    '모르는 마법부여 등급',
    {
      ...dealerCard,
      investment: [{ ...firstInvestment, enchant: { status: [], grade: '최상' } }]
    }
  ],
  ['배열이 아닌 부위 목록', { ...dealerCard, investment: {} }]
]

it.each(invalidCards)('%s가 있는 카드 값은 일반 preload 스키마처럼 거부한다', (_, card) => {
  expect(characterCardSchema.safeParse(card).success).toBe(false)
  expect(isCharacterDetailCard(card)).toBe(false)
  expect(() => parseCharacterDetailSnapshot({ ...snapshot, card })).toThrow(
    'CHARACTER_DETAIL_UNAVAILABLE'
  )
})

const weaponText = {
  explain: '[용을 베는 자]\n모든 속도 +20%',
  buff: '30레벨 버프 스킬 Lv +1',
  flavor: null
}

it('설명 상자 문구는 itemId별로 받고 복사해 넘긴다', () => {
  const itemTexts = { '4f7c8199cd7a85492e985ebb5daa2da8': weaponText }
  const parsed = parseCharacterDetailSnapshot({ ...snapshot, itemTexts })

  expect(parsed.itemTexts).toEqual(itemTexts)
  expect(parsed.itemTexts).not.toBe(itemTexts)
})

it('12부위, 서약 본체, 결정 11칸을 합친 24개까지 받는다', () => {
  const entries = (count: number) =>
    Object.fromEntries(Array.from({ length: count }, (_, index) => [`item-${index}`, weaponText]))

  expect(
    Object.keys(parseCharacterDetailSnapshot({ ...snapshot, itemTexts: entries(24) }).itemTexts)
  ).toHaveLength(24)
  expect(() => parseCharacterDetailSnapshot({ ...snapshot, itemTexts: entries(25) })).toThrow(
    'CHARACTER_DETAIL_UNAVAILABLE'
  )
})

it.each([
  ['배열인', [weaponText]],
  ['null인', null],
  ['잘못된 itemId를 쓴', { '../escape': weaponText }],
  ['symbol 키가 있는', { [Symbol('item')]: weaponText }],
  ['문구 칸이 빠진', { item: { explain: null, buff: null } }],
  ['문구 칸이 더 있는', { item: { ...weaponText, itemName: '이름' } }],
  ['문자열이 아닌 문구가 있는', { item: { ...weaponText, buff: 1 } }],
  ['빈 문구가 있는', { item: { ...weaponText, flavor: ' ' } }],
  [
    '최대 길이를 넘은 문구가 있는',
    { item: { ...weaponText, explain: 'a'.repeat(CHARACTER_DETAIL_ITEM_TEXT_MAX_LENGTH + 1) } }
  ]
])('%s 설명 상자 문구는 거부한다', (_, itemTexts) => {
  expect(() => parseCharacterDetailSnapshot({ ...snapshot, itemTexts })).toThrow(
    'CHARACTER_DETAIL_UNAVAILABLE'
  )
})

it('최대 길이의 문구는 받는다', () => {
  const explain = 'a'.repeat(CHARACTER_DETAIL_ITEM_TEXT_MAX_LENGTH)
  const itemTexts = { item: { ...weaponText, explain } }

  expect(parseCharacterDetailSnapshot({ ...snapshot, itemTexts }).itemTexts.item.explain).toBe(
    explain
  )
})

const skills = {
  jobId: '41f1cdc2ff58bb5fdc287be0db2a8df3',
  jobGrowId: '37495b941da3b1661bc900e68ef3b2c6',
  learned: {
    eb71e1d82d92c7e1d40500a0dcd77aa6: {
      name: '귀참',
      level: 60,
      description: '무기에 귀신을 소환하여 전방 넓은 범위에 강력한 베기를 행한다.',
      coolTime: 6,
      vpNames: ['쾌속발도', '흐르는 칼날'],
      vpName: '흐르는 칼날'
    },
    dcd536f1674630f01fc9667bb202b851: {
      name: '신속한 무기 교체',
      level: 1,
      description: null,
      coolTime: null,
      vpNames: [],
      vpName: null
    }
  }
}

it('스킬 탭 값은 직업 ID와 skillId별 스킬로 받고 복사해 넘긴다', () => {
  const parsed = parseCharacterDetailSnapshot({ ...snapshot, skills })

  expect(parsed.skills).toEqual(skills)
  expect(parsed.skills).not.toBe(skills)
  expect(parsed.skills?.learned).not.toBe(skills.learned)
})

it('습득 스킬은 200개까지 받는다', () => {
  const skill = skills.learned.eb71e1d82d92c7e1d40500a0dcd77aa6
  const learned = (count: number) =>
    Object.fromEntries(Array.from({ length: count }, (_, index) => [`skill-${index}`, skill]))

  expect(
    Object.keys(
      parseCharacterDetailSnapshot({ ...snapshot, skills: { ...skills, learned: learned(200) } })
        .skills?.learned ?? {}
    )
  ).toHaveLength(200)
  expect(() =>
    parseCharacterDetailSnapshot({ ...snapshot, skills: { ...skills, learned: learned(201) } })
  ).toThrow('CHARACTER_DETAIL_UNAVAILABLE')
})

const skill = skills.learned.eb71e1d82d92c7e1d40500a0dcd77aa6

it.each([
  ['undefined인', undefined],
  ['배열인', []],
  ['잘못된 jobId를 쓴', { ...skills, jobId: '../escape' }],
  ['jobGrowId가 빠진', { jobId: skills.jobId, learned: skills.learned }],
  ['필드가 더 있는', { ...skills, extra: true }],
  ['잘못된 skillId를 쓴', { ...skills, learned: { '../escape': skill } }],
  ['음수 레벨', { ...skills, learned: { skill: { ...skill, level: -1 } } }],
  ['소수 레벨', { ...skills, learned: { skill: { ...skill, level: 1.5 } } }],
  ['빈 이름', { ...skills, learned: { skill: { ...skill, name: ' ' } } }],
  ['음수 쿨타임', { ...skills, learned: { skill: { ...skill, coolTime: -1 } } }],
  ['빈 VP 이름', { ...skills, learned: { skill: { ...skill, vpName: '' } } }],
  [
    'VP 이름 목록에 없는 고른 VP',
    { ...skills, learned: { skill: { ...skill, vpName: '다른 VP' } } }
  ],
  ['빈 VP 이름 목록 항목', { ...skills, learned: { skill: { ...skill, vpNames: [''] } } }],
  [
    '최대 길이를 넘은 설명',
    {
      ...skills,
      learned: {
        skill: { ...skill, description: 'a'.repeat(CHARACTER_DETAIL_ITEM_TEXT_MAX_LENGTH + 1) }
      }
    }
  ],
  ['스킬 칸이 더 있는', { ...skills, learned: { skill: { ...skill, iconUrl: 'x' } } }]
])('%s 스킬 탭 값은 거부한다', (_, value) => {
  expect(() => parseCharacterDetailSnapshot({ ...snapshot, skills: value })).toThrow(
    'CHARACTER_DETAIL_UNAVAILABLE'
  )
})

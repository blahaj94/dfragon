import { expect, it } from 'vitest'
import apiBufferFixture from '../../../../api/test/fixtures/character-card-buffer.json'
import apiDealerFixture from '../../../../api/test/fixtures/character-card-dealer.json'
import { isCharacterDetailCard, parseCharacterDetailSnapshot } from './character-detail'
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

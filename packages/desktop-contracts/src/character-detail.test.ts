import { expect, it } from 'vitest'
import { parseCharacterDetailSnapshot } from './character-detail'
import {
  CHARACTER_SERVER_NAMES,
  characterImageUrl,
  characterSummarySchema
} from './search/character-summary'
import type { CharacterDetailSnapshot } from './types/character-detail'

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
    imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/id_-123?zoom=1'
  },
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
    expect(characterSummarySchema.parse(value.character)).toEqual(value.character)
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

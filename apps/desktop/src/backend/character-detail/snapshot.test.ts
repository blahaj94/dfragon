import { describe, expect, it } from 'vitest'
import type { CharacterDetails } from '../../preload/common/types/character'
import { createCharacterDetailSnapshot } from './snapshot'

function details(): CharacterDetails {
  return {
    character: {
      serverId: 'cain',
      characterId: 'character-1',
      characterName: '가나',
      serverName: '카인',
      adventureName: '모험단',
      jobName: '귀검사',
      jobGrowName: '웨펀마스터',
      level: 115,
      fame: 71000,
      guildName: '길드'
    },
    status: { status: [{ name: '힘', value: 100 }], buff: null },
    equipment: { equipment: [{ itemId: 'equipment-1' }], setItemInfo: [] },
    avatar: [{ itemId: 'avatar-1' }],
    creature: { itemId: 'creature-1' },
    oath: null,
    mistAssimilation: null,
    skillStyle: null,
    buff: { equipment: null, avatar: null, creature: null },
    sections: {},
    freshness: {
      lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z',
      expiresAt: '2026-10-07T00:05:00.000Z'
    }
  }
}

describe('캐릭터 상세 창 snapshot', () => {
  it('기본 정보와 조회 시각만 노출하고 장비와 평가 데이터는 전달하지 않는다', () => {
    const snapshot = createCharacterDetailSnapshot(details())

    expect(snapshot).toEqual({
      character: {
        serverId: 'cain',
        characterId: 'character-1',
        characterName: '가나',
        serverName: '카인',
        adventureName: '모험단',
        jobName: '귀검사',
        jobGrowName: '웨펀마스터',
        level: 115,
        fame: 71000,
        imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/character-1?zoom=1'
      },
      freshness: {
        lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z',
        expiresAt: '2026-10-07T00:05:00.000Z'
      }
    })
  })

  it.each([null, 0])('명성과 레벨 %s를 다른 표시값으로 대체하지 않는다', (value) => {
    const source = details()
    const snapshot = createCharacterDetailSnapshot({
      ...source,
      character: { ...source.character, fame: value, level: value, adventureName: null }
    })

    expect(snapshot.character).toMatchObject({ fame: value, level: value, adventureName: null })
  })

  it('선택적 필드가 없거나 표시 타입이 아니면 null로 남긴다', () => {
    const source = details()
    const snapshot = createCharacterDetailSnapshot({
      ...source,
      character: {
        serverId: 'cain',
        characterId: 'character-1',
        characterName: '가나',
        serverName: '카인',
        jobName: {},
        jobGrowName: [],
        level: '115',
        fame: Number.NaN
      }
    })

    expect(snapshot.character).toMatchObject({
      adventureName: null,
      jobName: null,
      jobGrowName: null,
      level: null,
      fame: null
    })
  })

  it('원본 객체의 후속 변경이 이미 만든 snapshot을 바꾸지 않는다', () => {
    const source = details()
    const snapshot = createCharacterDetailSnapshot(source)
    Object.assign(source.character, { characterName: '변경됨' })
    Object.assign(source.freshness, { expiresAt: '2026-10-07T01:00:00.000Z' })

    expect(snapshot.character.characterName).toBe('가나')
    expect(snapshot.freshness.expiresAt).toBe('2026-10-07T00:05:00.000Z')
  })
})

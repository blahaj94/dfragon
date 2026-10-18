import { describe, expect, it } from 'vitest'
import { parseSearchResult, parseSearchSnapshot } from './snapshot'
import {
  searchRow,
  searchSlot,
  searchSnapshot,
  withSearchSlot
} from '../../api/search-test-fixture'
import { SEARCH_SLOT_COUNTS } from '../types/search'

const selected = {
  ...searchRow,
  serverName: '카인',
  fame: 0,
  level: null,
  adventureName: null,
  jobName: '귀검사',
  jobGrowName: null,
  imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/synthetic-character?zoom=1',
  guildName: null,
  equipmentScore: null,
  serverRank: null
}

describe('선택된 캐릭터 요약과 대기 snapshot', () => {
  it('기존 요약 없는 성공과 일치 identity의 nullable 요약을 보존한다', () => {
    const old = withSearchSlot(searchSlot({ state: 'success', rows: [searchRow] }))
    expect(parseSearchSnapshot(old)).toEqual(old)
    const snapshot = withSearchSlot(searchSlot({ state: 'success', rows: [searchRow], selected }))
    expect(parseSearchSnapshot(snapshot)).toEqual(snapshot)
  })

  it('길드, 장비 점수, 서버 순위 값이 오면 그대로 전달한다', () => {
    const filled = { ...selected, guildName: '합성길드', equipmentScore: 0, serverRank: 37 }
    const snapshot = withSearchSlot(
      searchSlot({ state: 'success', rows: [searchRow], selected: filled })
    )
    expect(parseSearchSnapshot(snapshot)).toEqual(snapshot)
  })

  it.each(['waiting-portrait', 'waiting-policy'] as const)(
    '%s는 현재 요청의 빈 대기 상태만 허용한다',
    (state) => {
      const snapshot = withSearchSlot(searchSlot({ state }))
      expect(parseSearchSnapshot(snapshot)).toEqual(snapshot)
      expect(
        parseSearchSnapshot(withSearchSlot(searchSlot({ state, rows: [searchRow] })))
      ).toBeNull()
      expect(
        parseSearchSnapshot(
          withSearchSlot(
            searchSlot({ state, error: { code: 'NEOPLE_UNAVAILABLE', retryAfterSeconds: null } })
          )
        )
      ).toBeNull()
      expect(parseSearchSnapshot(withSearchSlot(searchSlot({ state, requestId: null })))).toBeNull()
    }
  )

  it.each([
    ['임의 이미지 호스트', { ...selected, imageUrl: 'https://example.test/face.png' }],
    [
      '다른 캐릭터 이미지',
      {
        ...selected,
        imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/other?zoom=1'
      }
    ],
    ['이미지 query 추가', { ...selected, imageUrl: selected.imageUrl + '&tracking=1' }],
    ['지원하지 않는 서버', { ...selected, serverId: 'future' }],
    ['다른 서버명', { ...selected, serverName: '시로코' }],
    [
      '다른 identity',
      {
        ...selected,
        characterId: 'other',
        imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/other?zoom=1'
      }
    ],
    ['숫자가 아닌 명성', { ...selected, fame: '0' }],
    ['무한 레벨', { ...selected, level: Infinity }],
    ['객체 직업명', { ...selected, jobName: {} }],
    ['길드 누락', { ...selected, guildName: undefined }],
    ['숫자 길드', { ...selected, guildName: 1 }],
    ['문자 장비 점수', { ...selected, equipmentScore: '414806' }],
    ['0위 서버 순위', { ...selected, serverRank: 0 }],
    ['소수 서버 순위', { ...selected, serverRank: 1.5 }],
    ['추가 상세 정보', { ...selected, details: {} }],
    ['선택 undefined', undefined],
    ['숨긴 추가 정보', Object.defineProperty({ ...selected }, 'private', { value: true })],
    [
      '상속 필드',
      Object.assign(Object.create({ jobName: '귀검사' }), { ...selected, jobName: undefined })
    ]
  ])('%s 요약은 renderer로 전달하지 않는다', (_name, invalid) => {
    const snapshot = withSearchSlot(searchSlot({ state: 'success', rows: [searchRow] }))
    const slots = [{ ...snapshot.slots[0], selected: invalid }, ...snapshot.slots.slice(1)]
    expect(parseSearchSnapshot({ ...snapshot, slots })).toBeNull()
  })

  it('성공 외 상태와 여러 후보에 selected를 붙이지 못한다', () => {
    for (const state of [
      'idle',
      'pending',
      'empty',
      'failure',
      'waiting-portrait',
      'waiting-policy'
    ] as const) {
      expect(parseSearchSnapshot(withSearchSlot(searchSlot({ state, selected })))).toBeNull()
    }
    expect(
      parseSearchSnapshot(
        withSearchSlot(searchSlot({ state: 'success', rows: [searchRow, searchRow], selected }))
      )
    ).toBeNull()
  })
})

describe('검색 수명별 슬롯 수', () => {
  const raidSnapshot = searchSnapshot({
    slots: Array.from({ length: SEARCH_SLOT_COUNTS.raid }, (_, slot) => ({
      ...searchSnapshot().slots[0],
      slot
    }))
  })

  it('공대 채널은 순서대로 놓인 12자리만 받는다', () => {
    expect(parseSearchSnapshot(raidSnapshot, SEARCH_SLOT_COUNTS.raid)).toEqual(raidSnapshot)
    expect(
      parseSearchResult({ ok: true, snapshot: raidSnapshot }, SEARCH_SLOT_COUNTS.raid)
    ).toEqual({ ok: true, snapshot: raidSnapshot })
    expect(parseSearchSnapshot(searchSnapshot(), SEARCH_SLOT_COUNTS.raid)).toBeNull()
    const reversed = { ...raidSnapshot, slots: [...raidSnapshot.slots].reverse() }
    expect(parseSearchSnapshot(reversed, SEARCH_SLOT_COUNTS.raid)).toBeNull()
  })

  it('파티 채널은 12자리 snapshot을 받지 않는다', () => {
    expect(parseSearchSnapshot(raidSnapshot)).toBeNull()
    expect(parseSearchResult({ ok: true, snapshot: raidSnapshot })).toBeNull()
  })
})

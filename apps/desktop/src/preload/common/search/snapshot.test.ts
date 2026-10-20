import { describe, expect, it } from 'vitest'
import { parseSearchResult, parseSearchSnapshot } from './snapshot'
import {
  searchRow,
  searchSlot,
  searchSnapshot,
  withSearchSlot
} from '../../api/search-test-fixture'
import { SEARCH_SLOT_COUNTS } from '../types/search'
import { characterCardSchema } from './character-summary'
import { bufferCard, dealerCard } from './card-test-fixture'

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
  serverRank: null,
  card: null
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

  it.each([
    ['딜러', dealerCard],
    ['버퍼', bufferCard]
  ])('%s 카드와 엔진이 채운 점수를 요약과 함께 전달한다', (_name, card) => {
    const score = {
      calculator: 'equipment',
      value: 1741,
      skipped: null,
      versions: { package: '0.1.0', rulesRev: 'rev12', bundleId: 'phase31-rev12' }
    } as const
    const filled = { ...selected, equipmentScore: 1741, serverRank: 12, card: { ...card, score } }
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

describe('얼굴로 확정하지 못한 선택의 후보', () => {
  const chosen = {
    ...searchRow,
    adventureName: '합성모험단',
    face: { x: 3, y: 0, width: 26, height: 26 }
  }
  const other = {
    ...searchRow,
    characterId: 'synthetic-other',
    serverId: 'siroco',
    serverName: '시로코',
    adventureName: null,
    face: null
  }
  const withChoices = (choices: unknown, slotSelected: unknown = selected) =>
    withSearchSlot({
      ...searchSlot({ state: 'success', rows: [searchRow], selected: slotSelected as never }),
      choices
    } as never)

  it('선택한 캐릭터를 포함한 두 명 이상의 후보를 전달한다', () => {
    const snapshot = withChoices([other, chosen])

    expect(parseSearchSnapshot(snapshot)).toEqual(snapshot)
  })

  it.each([
    ['선택한 캐릭터가 없는 후보', [other, { ...other, characterId: 'synthetic-third' }]],
    ['후보 한 명', [chosen]],
    ['음수 얼굴 창', [other, { ...chosen, face: { ...chosen.face, x: -1 } }]],
    ['소수 얼굴 창', [other, { ...chosen, face: { ...chosen.face, width: 1.5 } }]],
    ['숫자 모험단명', [other, { ...chosen, adventureName: 1 }]],
    ['추가 정보', [other, { ...chosen, distance: 3 }]]
  ])('%s는 snapshot 전체를 거절한다', (_name, choices) => {
    expect(parseSearchSnapshot(withChoices(choices))).toBeNull()
  })

  it('선택한 캐릭터 없이 후보만 보낼 수 없다', () => {
    const snapshot = withSearchSlot({
      ...searchSlot({ state: 'success', rows: [searchRow] }),
      choices: [other, chosen]
    } as never)

    expect(parseSearchSnapshot(snapshot)).toBeNull()
  })
})

describe('카드 strict 스키마', () => {
  const [weapon] = dealerCard.investment
  it.each([
    ['최상위 추가 키', { ...dealerCard, imageUrl: 'https://img-api.neople.co.kr/df/items/x' }],
    ['스탯 추가 키', { ...dealerCard, stats: { ...dealerCard.stats, label: '공격력 증가' } }],
    [
      '세트 슬롯 추가 키',
      {
        ...dealerCard,
        set: { ...dealerCard.set, slots: [{ slotId: 'WEAPON', rarity: null, x: 1 }] }
      }
    ],
    ['투자 행 추가 키', { ...dealerCard, investment: [{ ...weapon, display: '+12' }] }],
    ['역할 누락', { ...dealerCard, role: undefined }],
    ['알 수 없는 역할', { ...dealerCard, role: 'tank' }],
    [
      '역할에 맞지 않는 스탯 칸',
      { ...dealerCard, stats: { role: 'dealer', townStat: 1, switchingLevel: null } }
    ],
    [
      '문자 공격력 증가',
      { ...dealerCard, stats: { ...dealerCard.stats, attackIncrease: '34458' } }
    ],
    ['무한 크리티컬', { ...dealerCard, stats: { ...dealerCard.stats, critical: Infinity } }],
    ['NaN 증폭', { ...dealerCard, stats: { ...dealerCard.stats, amplification: Number.NaN } }],
    ['빈 세트 이름', { ...dealerCard, set: { ...dealerCard.set, name: ' ' } }],
    ['빈 서약 아이템', { ...dealerCard, oath: { ...dealerCard.oath, itemId: '' } }],
    ['0위 서버 순위', { ...dealerCard, serverRank: { ...dealerCard.serverRank, rank: 0 } }],
    [
      '전체 범위 순위',
      { ...dealerCard, serverRank: { ...dealerCard.serverRank, scope: 'global' } }
    ],
    [
      '날짜가 아닌 관측 시각',
      { ...dealerCard, serverRank: { ...dealerCard.serverRank, observedAt: 'now' } }
    ],
    [
      '소수 강화 수치',
      { ...dealerCard, investment: [{ ...weapon, reinforce: { ...weapon.reinforce, value: 1.5 } }] }
    ],
    [
      '정하지 않은 마법부여 등급',
      { ...dealerCard, investment: [{ ...weapon, enchant: { status: [], grade: '중간' } }] }
    ],
    [
      '빈 건너뛰기 사유',
      {
        ...dealerCard,
        score: {
          calculator: 'equipment',
          value: null,
          skipped: { kind: 'resolution', message: '' },
          versions: { package: '0.1.0', rulesRev: 'rev12', bundleId: 'phase31-rev12' }
        }
      }
    ],
    ['배열이 아닌 투자 현황', { ...dealerCard, investment: null }]
  ])('%s 카드를 거절한다', (_name, invalid) => {
    expect(characterCardSchema.safeParse(dealerCard).success).toBe(true)
    expect(characterCardSchema.safeParse(invalid).success).toBe(false)
  })

  it('요약의 카드가 스키마를 어기면 snapshot 전체를 renderer로 전달하지 않는다', () => {
    const invalid = { ...selected, card: { ...dealerCard, extra: true } }
    const snapshot = withSearchSlot(
      searchSlot({ state: 'success', rows: [searchRow], selected: invalid })
    )
    expect(parseSearchSnapshot(snapshot)).toBeNull()
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

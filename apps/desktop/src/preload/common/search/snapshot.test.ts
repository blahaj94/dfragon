import { describe, expect, it } from 'vitest'
import { parseSearchResult, parseSearchSnapshot } from './snapshot'
import {
  searchRow,
  searchSlot,
  searchSnapshot,
  withSearchSlot
} from '../../api/search-test-fixture'
import { SEARCH_SLOT_COUNTS, type SearchSlot } from '../types/search'
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
  card: null
}

describe('선택된 캐릭터 요약과 대기 snapshot', () => {
  it('기존 요약 없는 성공과 일치 identity의 nullable 요약을 보존한다', () => {
    const old = withSearchSlot(searchSlot({ state: 'success', rows: [searchRow] }))
    expect(parseSearchSnapshot(old)).toEqual(old)
    const snapshot = withSearchSlot(searchSlot({ state: 'success', rows: [searchRow], selected }))
    expect(parseSearchSnapshot(snapshot)).toEqual(snapshot)
  })

  it('길드, 장비 점수 값이 오면 그대로 전달한다', () => {
    const filled = { ...selected, guildName: '합성길드', equipmentScore: 0 }
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
      approximate: null,
      versions: { package: '0.1.0', rulesRev: 'rev12', bundleId: 'phase31-rev12' }
    } as const
    const filled = { ...selected, equipmentScore: 1741, card: { ...card, score } }
    const snapshot = withSearchSlot(
      searchSlot({ state: 'success', rows: [searchRow], selected: filled })
    )
    expect(parseSearchSnapshot(snapshot)).toEqual(snapshot)
  })

  it.each(['pending', 'failed'] as const)(
    '이름과 서버만 정한 선택의 상세 상태 %s를 전달하고 선택 없이는 받지 않는다',
    (details) => {
      const snapshot = withSearchSlot(
        searchSlot({ state: 'success', rows: [searchRow], selected, details })
      )
      expect(parseSearchSnapshot(snapshot)).toEqual(snapshot)
      expect(
        parseSearchSnapshot(
          withSearchSlot(searchSlot({ state: 'success', rows: [searchRow], details }))
        )
      ).toBeNull()
      expect(
        parseSearchSnapshot(
          withSearchSlot(
            searchSlot({ state: 'success', rows: [searchRow], selected, details: 'done' as never })
          )
        )
      ).toBeNull()
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
    ['지운 서버 순위', { ...selected, serverRank: 12 }],
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
    for (const state of ['idle', 'pending', 'empty', 'failure'] as const) {
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

  it.each(['job', 'fame'] as const)(
    '공대 행 값의 선택 근거 %s를 후보와 함께 전달한다',
    (selectionMethod) => {
      const snapshot = withSearchSlot({
        ...searchSlot({ state: 'success', rows: [searchRow], selected: selected as never }),
        selectionMethod,
        choices: [other, { ...chosen, face: null }]
      } as never)

      expect(parseSearchSnapshot(snapshot)).toEqual(snapshot)
    }
  )

  it('선택한 캐릭터 없이 후보만 보낼 수 없다', () => {
    const snapshot = withSearchSlot({
      ...searchSlot({ state: 'success', rows: [searchRow] }),
      choices: [other, chosen]
    } as never)

    expect(parseSearchSnapshot(snapshot)).toBeNull()
  })
})

function acceptsCard(card: unknown): boolean {
  const snapshot = withSearchSlot(
    searchSlot({ state: 'success', rows: [searchRow], selected: { ...selected, card } as never })
  )

  return parseSearchSnapshot(snapshot) !== null
}

describe('카드 strict 스키마', () => {
  it.each([
    ['추가 키', { ...dealerCard, imageUrl: 'https://img-api.neople.co.kr/df/items/x' }],
    ['지운 스탯 칸', { ...dealerCard, stats: null }],
    ['역할 누락', { ...dealerCard, role: undefined }],
    ['알 수 없는 역할', { ...dealerCard, role: 'tank' }],
    [
      '빈 건너뛰기 사유',
      {
        ...dealerCard,
        score: {
          calculator: 'equipment',
          value: null,
          skipped: { kind: 'resolution', message: '' },
          approximate: null,
          versions: { package: '0.1.0', rulesRev: 'rev12', bundleId: 'phase31-rev12' }
        }
      }
    ]
  ])('%s 카드를 거절한다', (_name, invalid) => {
    expect(acceptsCard(dealerCard)).toBe(true)
    expect(acceptsCard(invalid)).toBe(false)
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

describe('슬롯 상태별 판정 경계', () => {
  const timeout = { code: 'SEARCH_TIMEOUT', retryAfterSeconds: null } as const
  const rateLimited = (retryAfterSeconds: unknown) =>
    ({ code: 'SEARCH_RATE_LIMITED', retryAfterSeconds }) as SearchSlot['error']
  const withoutField = (field: keyof SearchSlot) => {
    const { [field]: _removed, ...rest } = searchSlot()

    return withSearchSlot(rest as SearchSlot)
  }

  it.each([
    ['대기 중 요청', searchSlot()],
    ['빈 닉네임 요청', searchSlot({ nickname: '' })],
    ['결과 없음', searchSlot({ state: 'empty' })],
    ['한 행 성공', searchSlot({ state: 'success', rows: [searchRow] })],
    ['오류 실패', searchSlot({ state: 'failure', error: timeout })],
    ['재시도 0초 제한', searchSlot({ state: 'failure', error: rateLimited(0) })],
    ['재시도 시간 없는 제한', searchSlot({ state: 'failure', error: rateLimited(null) })],
    ['관찰이 남은 빈 idle', searchSlot({ state: 'idle', requestId: null, nickname: null })]
  ])('%s 슬롯을 전달한다', (_name, slot) => {
    const snapshot = withSearchSlot(slot)

    expect(parseSearchSnapshot(snapshot)).toEqual(snapshot)
  })

  it.each([
    ['알 수 없는 상태', searchSlot({ state: 'done' as never })],
    ['닉네임만 남은 idle', searchSlot({ state: 'idle', requestId: null })],
    ['요청만 남은 idle', searchSlot({ state: 'idle', nickname: null })],
    [
      '행이 남은 idle',
      searchSlot({ state: 'idle', requestId: null, nickname: null, rows: [searchRow] })
    ],
    [
      '오류가 남은 idle',
      searchSlot({ state: 'idle', requestId: null, nickname: null, error: timeout })
    ],
    ['음수 관찰', searchSlot({ observationRevision: -1 })],
    ['소수 관찰', searchSlot({ observationRevision: 1.5 })],
    ['오류가 붙은 성공', searchSlot({ state: 'success', rows: [searchRow], error: timeout })],
    ['오류가 붙은 결과 없음', searchSlot({ state: 'empty', error: timeout })],
    ['행이 붙은 결과 없음', searchSlot({ state: 'empty', rows: [searchRow] })],
    ['요청 ID가 없는 결과 없음', searchSlot({ state: 'empty', requestId: null })],
    [
      '재시도 0초 시간 초과',
      searchSlot({ state: 'failure', error: { ...timeout, retryAfterSeconds: 0 } })
    ],
    ['소수 재시도 제한', searchSlot({ state: 'failure', error: rateLimited(1.5) })],
    [
      '공백 캐릭터명 행',
      searchSlot({ state: 'success', rows: [{ ...searchRow, characterName: ' ' }] })
    ]
  ])('%s 슬롯이 있으면 snapshot을 거절한다', (_name, slot) => {
    expect(parseSearchSnapshot(withSearchSlot(slot))).toBeNull()
  })

  it.each([-1, 0.5, 1])('첫 자리에 슬롯 번호 %d가 오면 snapshot을 거절한다', (slot) => {
    const snapshot = searchSnapshot()
    const slots = [{ ...snapshot.slots[0], slot }, ...snapshot.slots.slice(1)]

    expect(parseSearchSnapshot({ ...snapshot, slots })).toBeNull()
  })

  it.each(['rows', 'error', 'nickname', 'requestId', 'observationRevision', 'state'] as const)(
    '%s 필드가 빠진 슬롯을 거절한다',
    (field) => {
      expect(parseSearchSnapshot(withoutField(field))).toBeNull()
    }
  )

  it('캡처가 끝난 snapshot은 관찰 번호까지 0으로 돌린 idle 슬롯만 받는다', () => {
    const reset = searchSnapshot({ captureId: null })
    expect(parseSearchSnapshot(reset)).toEqual(reset)
    const observedIdle = withSearchSlot(
      searchSlot({ state: 'idle', requestId: null, nickname: null, observationRevision: 1 })
    )
    expect(parseSearchSnapshot(observedIdle)).toEqual(observedIdle)
    expect(parseSearchSnapshot({ ...observedIdle, captureId: null })).toBeNull()
  })
})

describe('선택과 행, 후보의 identity 비교', () => {
  const choice = { ...searchRow, adventureName: null, face: null }
  const other = { ...choice, characterId: 'synthetic-other', serverId: 'siroco' }
  const selectedSlot = (overrides: Record<string, unknown>) =>
    withSearchSlot({
      ...searchSlot({ state: 'success', rows: [searchRow], selected }),
      ...overrides
    } as never)

  it.each([
    ['서버만 다른 행', { rows: [{ ...searchRow, serverId: 'siroco' }] }],
    ['캐릭터만 다른 행', { rows: [{ ...searchRow, characterId: 'synthetic-other' }] }],
    ['서버만 다른 후보', { choices: [other, { ...choice, serverId: 'siroco' }] }],
    ['캐릭터만 다른 후보', { choices: [other, { ...choice, characterId: 'synthetic-third' }] }],
    ['값이 undefined인 후보', { choices: undefined }],
    ['선택 근거만 있고 선택 없음', { selected: undefined, selectionMethod: 'job' }]
  ])('%s는 snapshot 전체를 거절한다', (_name, overrides) => {
    expect(parseSearchSnapshot(selectedSlot(overrides))).toBeNull()
  })
})

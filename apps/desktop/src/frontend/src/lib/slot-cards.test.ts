import { describe, expect, it } from 'vitest'
import { searchSlot } from '../../../preload/api/search-test-fixture'
import type { SelectedCharacterSummary } from '../../../preload/common/types/character'
import type { SearchSlot } from '../../../preload/common/types/search'
import { filledSlotCount, toSlotCards } from './slot-cards'

const NEXT_STEP = 'Alt+R로 다시 인식하거나 서버와 이름을 직접 조회해 주세요.'
const summary: SelectedCharacterSummary = {
  characterId: 'synthetic-character',
  characterName: '합성',
  serverId: 'cain',
  serverName: '카인',
  adventureName: '모험단',
  jobName: '직업',
  jobGrowName: null,
  level: 115,
  fame: 100,
  imageUrl: '',
  guildName: null,
  equipmentScore: null,
  card: null
}

function slot(state: SearchSlot['state'], overrides: Partial<SearchSlot> = {}): SearchSlot {
  return searchSlot({ state, ...overrides })
}

function input(
  slots: SearchSlot[],
  overrides: Partial<Parameters<typeof toSlotCards>[0]> = {}
): Parameters<typeof toSlotCards>[0] {
  return {
    slots,
    nicknames: slots.map(() => null),
    manualSlots: slots.map(() => false),
    recognizing: false,
    snapshotMarks: [],
    ...overrides
  }
}

describe('toSlotCards', () => {
  it('슬롯마다 검색 상태와 찾은 캐릭터를 카드 값으로 옮긴다', () => {
    const [found, idle] = toSlotCards(
      input([slot('success', { selected: summary }), slot('idle', { nickname: null })])
    )

    expect(found.state).toBe('success')
    expect(found.character).toMatchObject({ name: '합성', adventure: '모험단', job: '직업' })
    expect(idle.state).toBe('idle')
    expect(idle.character).toBeUndefined()
  })

  it('인식한 이름이 없는 슬롯은 nickname을 비운다', () => {
    const [named, unnamed] = toSlotCards(
      input([slot('idle'), slot('idle')], { nicknames: ['OCR첫후보', null] })
    )

    expect(named.nickname).toBe('OCR첫후보')
    expect(unnamed.nickname).toBeUndefined()
  })

  it('실패한 슬롯의 안내에 다음 조회 방법을 덧붙인다', () => {
    const [failed, pending] = toSlotCards(
      input([
        slot('failure', { error: { code: 'SEARCH_TIMEOUT', retryAfterSeconds: null } }),
        slot('pending')
      ])
    )

    expect(failed.notice?.endsWith(` ${NEXT_STEP}`)).toBe(true)
    expect(pending.notice).toBeUndefined()
  })

  it('공대 화면은 최고 명성 선택에 직업과 수치 안내를, 파티 화면은 외형 안내를 쓴다', () => {
    const slots = [slot('success', { selected: summary, selectionMethod: 'highest-fame' })]

    expect(toSlotCards(input(slots, { screen: 'raid' }))[0].notice).toBe(
      '직업과 수치 미확인, 최고 명성 후보입니다.'
    )
    expect(toSlotCards(input(slots))[0].notice).toBe('외형 미확인, 최고 명성 후보입니다.')
  })

  it('인식하는 동안 직접 조회하지 않은 슬롯만 진행 중으로 보인다', () => {
    const slots = [slot('idle'), slot('idle')]
    const manualSlots = [true, false]

    const recognizing = toSlotCards(input(slots, { manualSlots, recognizing: true }))
    const idle = toSlotCards(input(slots, { manualSlots, recognizing: false }))

    expect(recognizing.map((card) => card.loading)).toEqual([false, true])
    expect(idle.map((card) => card.loading)).toEqual([false, false])
  })

  it('스냅샷 표시를 같은 슬롯 번호의 카드에 붙인다', () => {
    const moved = { kind: 'moved', seat: 2 } as const
    const cards = toSlotCards(
      input([slot('idle'), slot('idle'), slot('idle')], { snapshotMarks: [undefined, moved] })
    )

    expect(cards.map((card) => card.snapshotMark)).toEqual([undefined, moved, undefined])
  })
})

describe('filledSlotCount', () => {
  it('캐릭터를 찾은 슬롯만 센다', () => {
    const cards = toSlotCards(
      input([
        slot('success', { selected: summary }),
        slot('success'),
        slot('pending', { selected: summary }),
        slot('idle')
      ])
    )

    expect(filledSlotCount(cards)).toBe(1)
  })
})

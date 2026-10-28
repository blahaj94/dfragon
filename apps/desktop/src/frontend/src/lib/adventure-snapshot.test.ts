import { describe, expect, it } from 'vitest'
import { searchSlot } from '../../../preload/api/search-test-fixture'
import type { SelectedCharacterSummary } from '../../../preload/common/types/character'
import type { SearchSlot } from '../../../preload/common/types/search'
import { compareWithSnapshot, slotAdventureName } from './adventure-snapshot'

const NONE = undefined
const absent = { kind: 'absent' } as const
const moved = (seat: number) => ({ kind: 'moved', seat }) as const

describe('compareWithSnapshot', () => {
  it('스냅샷 때와 같은 자리에 같은 모험단이 있으면 표시하지 않는다', () => {
    expect(compareWithSnapshot(['가', '나', '다', '라'], ['가', '나', '다', '라'])).toEqual([
      NONE,
      NONE,
      NONE,
      NONE
    ])
  })

  it('자리가 바뀐 카드에만 모험단이 스냅샷에서 있던 자리를 보인다', () => {
    expect(compareWithSnapshot(['가', '나', '다', '라'], ['나', '가', '다', '라'])).toEqual([
      moved(2),
      moved(1),
      NONE,
      NONE
    ])
  })

  it('스냅샷에 없는 모험단은 어느 자리에서든 경고한다', () => {
    expect(compareWithSnapshot(['가', '나', null, null], ['가', '나', '새', '다'])).toEqual([
      NONE,
      NONE,
      absent,
      absent
    ])
  })

  it('스냅샷에서 비어 있던 자리로 옮겨 간 스냅샷의 모험단은 경고하지 않고 원래 자리를 보인다', () => {
    expect(compareWithSnapshot(['가', '나', null], ['가', null, '나'])).toEqual([
      NONE,
      NONE,
      moved(2)
    ])
  })

  it('스냅샷에서 빠져 지금 비었거나 모험단을 모르는 자리는 표시하지 않는다', () => {
    expect(compareWithSnapshot(['가', '나', '다'], [null, '나', null])).toEqual([NONE, NONE, NONE])
  })

  it('모험단을 모르던 자리는 스냅샷에 넣지 않으므로 그 자리에 들어온 사람은 경고한다', () => {
    expect(compareWithSnapshot(['가', null, '다'], ['가', '나', '다'])).toEqual([
      NONE,
      absent,
      NONE
    ])
  })

  it('같은 자리에 남은 모험단을 먼저 맞추고 나머지에 스냅샷 자리를 차례로 배정한다', () => {
    expect(compareWithSnapshot(['가', '가', '나'], ['나', '가', '가'])).toEqual([
      moved(3),
      NONE,
      moved(1)
    ])
  })

  it('같은 모험단이 스냅샷보다 많이 들어오면 남는 쪽을 스냅샷에 없는 모험단으로 본다', () => {
    expect(compareWithSnapshot(['가', '나', null, '가'], ['가', '가', '가', '나'])).toEqual([
      NONE,
      moved(4),
      absent,
      moved(2)
    ])
  })
})

describe('slotAdventureName', () => {
  const character: SelectedCharacterSummary = {
    characterId: 'synthetic-character',
    characterName: '합성',
    serverId: 'cain',
    serverName: '카인',
    adventureName: null,
    jobName: null,
    jobGrowName: null,
    level: null,
    fame: null,
    imageUrl: '',
    guildName: null,
    equipmentScore: null,
    card: null
  }

  function slot(state: SearchSlot['state'], adventureName: string | null | undefined): SearchSlot {
    const selected = adventureName !== undefined ? { ...character, adventureName } : undefined

    return { ...searchSlot({ state }), selected }
  }

  it('캐릭터를 찾은 슬롯의 모험단명을 돌려준다', () => {
    expect(slotAdventureName(slot('success', ' 가 '))).toBe('가')
  })

  it.each([
    ['캐릭터를 찾지 못한 슬롯', slot('failure', '가')],
    ['조회 중인 슬롯', slot('pending', '가')],
    ['선택된 캐릭터가 없는 슬롯', slot('success', undefined)],
    ['모험단명이 없는 캐릭터', slot('success', null)],
    ['모험단명이 공백인 캐릭터', slot('success', '  ')]
  ])('%s은 모험단을 모르는 자리다', (_, input) => {
    expect(slotAdventureName(input)).toBeNull()
  })
})

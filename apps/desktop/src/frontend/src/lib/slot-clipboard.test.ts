import { describe, expect, it } from 'vitest'
import { searchSlot } from '../../../preload/api/search-test-fixture'
import type { SelectedCharacterSummary } from '../../../preload/common/types/character'
import type { SearchSlot } from '../../../preload/common/types/search'
import { toClipboardText } from './slot-clipboard'

function character(
  characterName: string,
  serverId: string,
  adventureName: string | null
): SelectedCharacterSummary {
  return {
    characterId: `synthetic-${characterName}`,
    characterName,
    serverId,
    serverName: '',
    adventureName,
    jobName: '직업',
    jobGrowName: null,
    level: 115,
    fame: 100,
    imageUrl: '',
    guildName: null,
    equipmentScore: null,
    card: null
  }
}

function found(name: string, serverId: string, adventure: string | null): SearchSlot {
  return searchSlot({
    state: 'success',
    nickname: name,
    selected: character(name, serverId, adventure)
  })
}

function slot(state: SearchSlot['state'], nickname: string | null): SearchSlot {
  return searchSlot({ state, nickname })
}

describe('toClipboardText', () => {
  it('파티는 자리 순서대로 찾은 자리, 찾지 못한 자리, 빈 자리를 한 줄에 잇는다', () => {
    const text = toClipboardText({
      slots: [
        found('퍼리조아', 'siroco', '검은전투늑대'),
        slot('empty', '퍼리조이'),
        slot('idle', null),
        found('달빛세레나', 'cain', '은하수')
      ],
      nicknames: [null, null, null, null],
      seatOrder: [0, 1, 2, 3],
      rowSize: 4
    })

    expect(text).toBe(
      '[퍼리조아, 시로코, 검은전투늑대], [퍼리조이, , ], [], [달빛세레나, 카인, 은하수]'
    )
  })

  it('검색을 시작하지 못한 자리는 인식한 이름을 넣는다', () => {
    const text = toClipboardText({
      slots: [slot('idle', null), slot('failure', null)],
      nicknames: ['인식이름', null],
      seatOrder: [0, 1],
      rowSize: 2
    })

    expect(text).toBe('[인식이름, , ], []')
  })

  it('조회 중이거나 실패한 자리는 이전 선택이 있어도 찾지 못한 자리로 넣는다', () => {
    const stale = character('이전캐릭터', 'cain', '이전모험단')
    const text = toClipboardText({
      slots: [
        searchSlot({ state: 'pending', nickname: '새이름', selected: stale }),
        searchSlot({ state: 'failure', nickname: '실패이름', selected: stale })
      ],
      nicknames: [null, null],
      seatOrder: [0, 1],
      rowSize: 2
    })

    expect(text).toBe('[새이름, , ], [실패이름, , ]')
  })

  it('모험단이 없는 캐릭터는 모험단 칸을 비운다', () => {
    const text = toClipboardText({
      slots: [found('무소속', 'anton', null)],
      nicknames: [null],
      seatOrder: [0],
      rowSize: 1
    })

    expect(text).toBe('[무소속, 안톤, ]')
  })

  it('공대는 화면 자리 순서를 따라 파티마다 줄을 나누고 마지막 줄 말고는 줄 끝에 쉼표를 둔다', () => {
    const slots = Array.from({ length: 12 }, (_, index) =>
      index === 5 ? slot('idle', null) : found(`이름${index + 1}`, 'cain', `단${index + 1}`)
    )
    const seatOrder = [1, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

    const text = toClipboardText({
      slots,
      nicknames: slots.map(() => null),
      seatOrder,
      rowSize: 4
    })

    expect(text.split('\n')).toEqual([
      '[이름2, 카인, 단2], [이름1, 카인, 단1], [이름3, 카인, 단3], [이름4, 카인, 단4],',
      '[이름5, 카인, 단5], [], [이름7, 카인, 단7], [이름8, 카인, 단8],',
      '[이름9, 카인, 단9], [이름10, 카인, 단10], [이름11, 카인, 단11], [이름12, 카인, 단12]'
    ])
  })
})

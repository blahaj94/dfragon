import { describe, expect, it } from 'vitest'
import type { SelectedCharacterSummary } from '../../../preload/common/types/character'
import type { SearchSlot } from '../../../preload/common/types/search'
import { dealerCard } from '../testing/fixtures/character-cards'
import { searchSlotNotice, toCharacterCard } from './character-card'

const nextStep = '다음 안내'

const summary: SelectedCharacterSummary = {
  characterId: 'fixture-character',
  characterName: '실제이름',
  serverId: 'cain',
  serverName: '카인',
  adventureName: null,
  jobName: '직업',
  jobGrowName: null,
  level: 115,
  fame: 0,
  imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/fixture-character?zoom=1',
  guildName: null,
  equipmentScore: null,
  card: null
}

it('선택한 기본 정보와 명성 0을 보존하고 main이 넘기지 않은 카드 값을 만들어내지 않는다', () => {
  expect(toCharacterCard(summary)).toEqual({
    characterId: 'fixture-character',
    name: '실제이름',
    serverId: 'cain',
    adventure: '-',
    job: '직업',
    level: 115,
    fame: 0,
    guild: null,
    card: null,
    image: summary.imageUrl
  })
  expect(toCharacterCard({ ...summary, fame: null, level: null, jobName: null })).toMatchObject({
    fame: null,
    level: null,
    job: '-'
  })
  expect(
    toCharacterCard({
      ...summary,
      guildName: '길드',
      equipmentScore: 414806,
      card: dealerCard
    })
  ).toMatchObject({ guild: '길드', card: dealerCard })
  expect(toCharacterCard(undefined)).toBeUndefined()
  expect(toCharacterCard({ ...summary, serverId: 'unknown' })).toBeUndefined()
})

it('호출 제한 실패는 정제된 오류를, 오류가 없는 실패는 결과 없음을 다음 안내와 함께 표시한다', () => {
  const slot: SearchSlot = {
    slot: 0,
    observationRevision: 1,
    requestId: 'request',
    nickname: '이름',
    state: 'failure',
    rows: [],
    error: { code: 'SEARCH_RATE_LIMITED' }
  }
  expect(searchSlotNotice(slot, nextStep)).toBe(
    '검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요. 다음 안내'
  )
  expect(searchSlotNotice({ ...slot, error: null }, nextStep)).toBe(
    '검색 결과가 없습니다. 다음 안내'
  )
})

it('외형을 확인하지 못한 최고 명성 후보임을 명시한다', () => {
  const slot: SearchSlot = {
    slot: 0,
    observationRevision: 1,
    requestId: 'request',
    nickname: '이름',
    state: 'success',
    rows: [],
    error: null,
    selected: summary,
    selectionMethod: 'highest-fame'
  }
  expect(searchSlotNotice(slot, nextStep)).toBe('외형 미확인, 최고 명성 후보입니다.')
  expect(searchSlotNotice({ ...slot, selectionMethod: 'portrait' }, nextStep)).toBeUndefined()
  expect(searchSlotNotice({ ...slot, selectionMethod: 'manual' }, nextStep)).toBeUndefined()
})

it('후보 창이 있는 최고 명성 선택은 같은 뜻의 문구를 겹치지 않는다', () => {
  const slot: SearchSlot = {
    slot: 0,
    observationRevision: 1,
    requestId: 'request',
    nickname: '이름',
    state: 'success',
    rows: [],
    error: null,
    selected: summary,
    selectionMethod: 'highest-fame',
    choices: [
      { ...summary, adventureName: null, face: null },
      { ...summary, serverId: 'siroco', serverName: '시로코', adventureName: null, face: null }
    ].map(({ characterId, characterName, serverId, serverName, fame, adventureName, face }) => ({
      characterId,
      characterName,
      serverId,
      serverName,
      fame,
      adventureName,
      face
    }))
  }
  expect(searchSlotNotice(slot, nextStep)).toBeUndefined()
})

describe('공대 카드의 선택 근거 안내', () => {
  const base: SearchSlot = {
    slot: 0,
    observationRevision: 1,
    requestId: 'request',
    nickname: '이름',
    state: 'success',
    rows: [],
    error: null,
    selected: summary
  }
  const choices = [{ ...summary, adventureName: null, face: null }].map(
    ({ characterId, characterName, serverId, serverName, fame, adventureName, face }) => ({
      characterId,
      characterName,
      serverId,
      serverName,
      fame,
      adventureName,
      face
    })
  )

  it.each(['job', 'fame'] as const)(
    '%s로 확정한 선택은 안내 없이 스탯 줄을 보인다',
    (selectionMethod) => {
      expect(searchSlotNotice({ ...base, selectionMethod }, nextStep, 'raid')).toBeUndefined()
    }
  )

  it.each([['fame', '명성으로 추정한 후보입니다.']] as const)(
    '%s로 확정하지 못한 선택은 추정 안내를 보인다',
    (selectionMethod, notice) => {
      expect(searchSlotNotice({ ...base, selectionMethod, choices }, nextStep, 'raid')).toBe(notice)
    }
  )

  it('최고 명성 선택은 후보 창 여부와 무관하게 직업과 수치를 확인하지 못했다고 안내한다', () => {
    const notice = '직업과 수치 미확인, 최고 명성 후보입니다.'

    expect(searchSlotNotice({ ...base, selectionMethod: 'highest-fame' }, nextStep, 'raid')).toBe(
      notice
    )
    expect(
      searchSlotNotice({ ...base, selectionMethod: 'highest-fame', choices }, nextStep, 'raid')
    ).toBe(notice)
    expect(searchSlotNotice({ ...base, selectionMethod: 'highest-fame' }, nextStep)).toBe(
      '외형 미확인, 최고 명성 후보입니다.'
    )
  })

  it('선택 근거가 없는 공대 실패 카드는 기존 오류 문구를 쓴다', () => {
    const failed: SearchSlot = {
      ...base,
      state: 'failure',
      selected: undefined,
      error: { code: 'SEARCH_TIMEOUT' }
    }

    expect(searchSlotNotice(failed, nextStep, 'raid')).toBe(
      '검색 시간이 초과됐습니다. 다시 시도해 주세요. 다음 안내'
    )
  })
})

it('실패와 결과 0건 안내에만 화면별 다음 조회 방법을 덧붙인다', () => {
  const slot: SearchSlot = {
    slot: 5,
    observationRevision: 1,
    requestId: 'request',
    nickname: '이름',
    state: 'empty',
    rows: [],
    error: null
  }
  expect(searchSlotNotice(slot, '서버와 이름을 다시 조회해 주세요.')).toBe(
    '검색 결과가 없습니다. 서버와 이름을 다시 조회해 주세요.'
  )
  expect(
    searchSlotNotice({ ...slot, state: 'failure', error: { code: 'SEARCH_TIMEOUT' } }, '다음 안내')
  ).toBe('검색 시간이 초과됐습니다. 다시 시도해 주세요. 다음 안내')
  expect(searchSlotNotice({ ...slot, state: 'pending' }, '다음 안내')).toBeUndefined()
})

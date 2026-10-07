import { expect, it } from 'vitest'
import type { CharacterSummary } from '../../../preload/common/types/character'
import type { SearchSlot } from '../../../preload/common/types/search'
import { canRetryCharacterSlot, characterSlotNotice, toCharacterCard } from './character-card'

const summary: CharacterSummary = {
  characterId: 'fixture-character',
  characterName: '실제이름',
  serverId: 'cain',
  serverName: '카인',
  adventureName: null,
  jobName: '직업',
  jobGrowName: null,
  level: 115,
  fame: 0,
  imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/fixture-character?zoom=1'
}

it('선택한 기본 정보와 명성 0을 보존하고 장비나 평가를 만들어내지 않는다', () => {
  expect(toCharacterCard(summary)).toEqual({
    characterId: 'fixture-character',
    name: '실제이름',
    serverId: 'cain',
    adventure: '—',
    job: '직업',
    level: 115,
    fame: 0,
    image: summary.imageUrl,
    equipment: [],
    oath: []
  })
  expect(toCharacterCard({ ...summary, fame: null, level: null, jobName: null })).toMatchObject({
    fame: null,
    level: null,
    job: '—'
  })
  expect(toCharacterCard(undefined)).toBeNull()
  expect(toCharacterCard({ ...summary, serverId: 'unknown' })).toBeNull()
})

it('서버 제한과 중복 요청을 지키고 정제된 오류만 표시한다', () => {
  const slot: SearchSlot = {
    slot: 0,
    observationRevision: 1,
    requestId: 'request',
    nickname: '이름',
    state: 'failure',
    rows: [],
    error: { code: 'SEARCH_RATE_LIMITED', retryAfterSeconds: 12 }
  }
  expect(canRetryCharacterSlot(slot, false)).toBe(false)
  expect(characterSlotNotice(slot)).toBe('12초 후 다시 시도할 수 있습니다.')
  const ready: SearchSlot = {
    ...slot,
    error: { code: 'SEARCH_RATE_LIMITED', retryAfterSeconds: 0 }
  }
  expect(canRetryCharacterSlot(ready, false)).toBe(true)
  expect(canRetryCharacterSlot(ready, true)).toBe(false)
  expect(canRetryCharacterSlot({ ...slot, state: 'waiting-portrait', error: null }, false)).toBe(
    false
  )
  expect(characterSlotNotice({ ...slot, error: null })).toBeUndefined()
  expect(
    canRetryCharacterSlot(
      { ...slot, error: { code: 'INVALID_SEARCH_QUERY', retryAfterSeconds: null } },
      false
    )
  ).toBe(false)
})

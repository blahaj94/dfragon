import { expect, it } from 'vitest'
import type { CharacterCandidate } from '@dfragon/desktop-contracts/types/character'
import { NO_RAID_OBSERVED_VALUES, selectRaidCandidate } from './raid-candidate'

function candidate(id: string, fame: number | null, serverId = 'cain'): CharacterCandidate {
  return {
    characterId: id,
    characterName: '공대원',
    serverId,
    serverName: '카인',
    fame,
    imageUrl: `https://img-api.neople.co.kr/df/servers/${serverId}/characters/${id}?zoom=1`
  }
}

function select(candidates: CharacterCandidate[], observed = NO_RAID_OBSERVED_VALUES) {
  return selectRaidCandidate({ name: '공대원', observed, candidates })
}

it('관측값이 비어 있으면 API 순서와 무관하게 최고 명성 후보를 최고 명성 선택으로 돌려준다', () => {
  const low = candidate('low', 1000)
  const high = candidate('high', 90000, 'bakal')
  const middle = candidate('middle', 50000)

  expect(select([low, high, middle])).toEqual({ candidate: high, selectionMethod: 'highest-fame' })
})

it('후보가 없으면 고르지 않는다', () => {
  expect(select([])).toBeNull()
})

it('명성이 같으면 API 순서의 앞 후보를 고르고 명성이 없는 후보는 0보다도 뒤에 둔다', () => {
  const first = candidate('first', 70000)
  const second = candidate('second', 70000)
  expect(select([first, second])?.candidate).toBe(first)

  const unknown = candidate('unknown', null)
  const zero = candidate('zero', 0)
  expect(select([unknown, zero])?.candidate).toBe(zero)
  expect(select([unknown])?.candidate).toBe(unknown)
})

it('공대 창의 명성, 장비 점수를 넘겨도 지금은 최고 명성 후보를 고른다', () => {
  const close = candidate('close', 41000)
  const highest = candidate('highest', 99000)

  expect(select([close, highest], { fame: 41000, equipmentScoreText: '1000.4K' })?.candidate).toBe(
    highest
  )
})

it('입력 후보 배열을 바꾸지 않는다', () => {
  const candidates = [candidate('a', 1), candidate('b', 2)]
  const before = [...candidates]
  select(candidates)

  expect(candidates).toEqual(before)
})

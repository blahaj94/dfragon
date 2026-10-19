import { beforeEach, expect, it, vi } from 'vitest'
import type { CharacterCandidate, CharacterDetails } from '../../preload/common/types/character'
import { createRaidCharacterIdentifier } from './identify'
import { NO_RAID_OBSERVED_VALUES, selectRaidCandidate } from './raid-candidate'

vi.mock('./raid-candidate', async (original) => {
  const actual = await original<typeof import('./raid-candidate')>()

  return { ...actual, selectRaidCandidate: vi.fn() }
})

function candidate(id: string, fame: number | null): CharacterCandidate {
  return {
    characterId: id,
    characterName: '공대원',
    serverId: 'cain',
    serverName: '카인',
    fame,
    imageUrl: `https://img-api.neople.co.kr/df/servers/cain/characters/${id}?zoom=1`,
    adventureName: null
  }
}

const candidates = [candidate('highest', 90000), candidate('chosen', 1000)]
const details = { character: { characterId: 'chosen' } } as unknown as CharacterDetails
const findCandidates = vi.fn(async (_nickname: string) => candidates)
const getDetails = vi.fn(async () => details)
const identify = createRaidCharacterIdentifier({ findCandidates, getDetails })

beforeEach(() => {
  vi.mocked(selectRaidCandidate).mockReset()
  findCandidates.mockClear()
  getDetails.mockClear()
})

it('공대 이름의 후보를 공대 후보 선택 함수에 넘기고 그 함수가 고른 캐릭터와 선택 근거를 쓴다', async () => {
  vi.mocked(selectRaidCandidate).mockReturnValue({
    candidate: candidates[1],
    selectionMethod: 'manual'
  })

  const result = await identify({ nicknames: ['공대원'], observed: NO_RAID_OBSERVED_VALUES })

  expect(selectRaidCandidate).toHaveBeenCalledExactlyOnceWith({
    name: '공대원',
    observed: NO_RAID_OBSERVED_VALUES,
    candidates
  })
  expect(getDetails).toHaveBeenCalledExactlyOnceWith({ serverId: 'cain', characterId: 'chosen' })
  expect(result).toEqual({
    kind: 'matched',
    candidate: candidates[1],
    details,
    nickname: '공대원',
    selectionMethod: 'manual'
  })
})

it('선택 함수가 고르지 않으면 상세를 조회하지 않고 미식별로 끝낸다', async () => {
  vi.mocked(selectRaidCandidate).mockReturnValue(null)

  expect(await identify({ nicknames: ['공대원'], observed: NO_RAID_OBSERVED_VALUES })).toEqual({
    kind: 'unmatched'
  })
  expect(getDetails).not.toHaveBeenCalled()
})

it.each([[['']], [[' 공대원']], [['가', '나', '다']], [[]]])(
  '검색할 수 없는 첫 이름 %j는 후보 검색 전에 거절한다',
  async (nicknames) => {
    expect(await identify({ nicknames, observed: NO_RAID_OBSERVED_VALUES })).toEqual({
      kind: 'invalid-input'
    })
    expect(findCandidates).not.toHaveBeenCalled()
    expect(selectRaidCandidate).not.toHaveBeenCalled()
  }
)

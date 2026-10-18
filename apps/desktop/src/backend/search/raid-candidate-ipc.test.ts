import { beforeEach, expect, it, vi } from 'vitest'
import { candidate, createSearchFixture, jsonResponse } from './search-test-fixture'
import { selectRaidCandidate } from './raid-candidate'
import type { CharacterCandidate } from '../../preload/common/types/character'

vi.mock('./raid-candidate', async (original) => {
  const actual = await original<typeof import('./raid-candidate')>()

  return { ...actual, selectRaidCandidate: vi.fn(actual.selectRaidCandidate) }
})

// 합성 픽셀용 테스트 정책이며 운영 기준이 아니다.
const policy = { maxMeanChannelError: 0, minCoverage: 1, minComparedPixels: 1 }
const highest = {
  ...candidate,
  fame: 90000,
  imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/synthetic-character?zoom=1'
}
const chosen = {
  ...candidate,
  characterId: 'synthetic-chosen',
  serverId: 'bakal',
  serverName: '바칼',
  fame: 1000,
  imageUrl: 'https://img-api.neople.co.kr/df/servers/bakal/characters/synthetic-chosen?zoom=1'
}

function ocr(captureId: string, slot: number) {
  return {
    captureId,
    slot,
    observationRevision: 1,
    nickname: '가나',
    candidateNicknames: ['가나'],
    portrait: null
  }
}

function detailsOf(character: CharacterCandidate) {
  const { imageUrl: _imageUrl, ...identity } = character

  return {
    character: { ...identity, level: 110, guildName: null },
    status: { status: [], buff: null },
    equipment: { equipment: [], setItemInfo: [] },
    avatar: null,
    creature: null,
    oath: null,
    mistAssimilation: null,
    skillStyle: null,
    buff: { equipment: null, avatar: null, creature: null },
    sections: Object.fromEntries(
      [
        'basic',
        'status',
        'equipment',
        'avatar',
        'creature',
        'oath',
        'mist_assimilation',
        'skill_style',
        'buff_equipment',
        'buff_avatar',
        'buff_creature'
      ].map((name) => [
        name,
        {
          revision: 1,
          contentUpdatedAt: '2026-10-19T00:00:00.000Z',
          lastSuccessfulFetchAt: '2026-10-19T00:00:00.000Z'
        }
      ])
    ),
    freshness: {
      lastSuccessfulFetchAt: '2026-10-19T00:00:00.000Z',
      expiresAt: '2026-10-19T00:05:00.000Z'
    }
  }
}

beforeEach(() => {
  vi.mocked(selectRaidCandidate).mockClear()
})

it('공대 수명의 OCR 이름은 공대 후보 선택 함수가 고른 캐릭터로 채운다', async () => {
  vi.mocked(selectRaidCandidate).mockImplementationOnce(({ candidates }) => {
    const picked = candidates.find((row) => row.characterId === chosen.characterId)!

    return { candidate: picked, selectionMethod: 'highest-fame' }
  })
  const fixture = await createSearchFixture(false, 'raid', policy)
  // 공대 캡처 회차처럼 게임 창을 등록한 뒤 공대 수명을 시작한다.
  await fixture.invoke('selectCaptureSource', 'window:search-fixture')
  const begun = (await fixture.invoke('controlRaidSearch', { action: 'begin' })) as {
    snapshot: { captureId: string }
  }
  fixture.fetchSearch
    .mockResolvedValueOnce(jsonResponse({ body: { rows: [highest, chosen] } }))
    .mockResolvedValueOnce(jsonResponse({ body: detailsOf(chosen) }))

  await fixture.invoke('notifyRaidOcrCandidatesDetected', ocr(begun.snapshot.captureId, 4))

  await vi.waitFor(async () => expect((await fixture.read()).slots[4].state).toBe('success'))
  expect((await fixture.read()).slots[4].selected).toMatchObject({
    characterId: 'synthetic-chosen',
    serverId: 'bakal'
  })
  expect(selectRaidCandidate).toHaveBeenCalledExactlyOnceWith({
    name: '가나',
    observed: { fame: null, equipmentScoreText: null },
    candidates: [highest, chosen]
  })
})

it('파티 캡처의 OCR 이름은 공대 후보 선택 함수를 쓰지 않는다', async () => {
  const fixture = await createSearchFixture(false, 'capture', policy)
  fixture.fetchSearch
    .mockResolvedValueOnce(jsonResponse({ body: { rows: [highest, chosen] } }))
    .mockResolvedValueOnce(jsonResponse({ body: detailsOf(highest) }))

  await fixture.invoke('notifyOcrCandidatesDetected', ocr(fixture.captureId, 1))

  await vi.waitFor(async () => expect((await fixture.read()).slots[1].state).toBe('success'))
  expect(selectRaidCandidate).not.toHaveBeenCalled()
})

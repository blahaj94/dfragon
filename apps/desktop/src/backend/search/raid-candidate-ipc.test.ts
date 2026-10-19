import { beforeEach, expect, it, vi } from 'vitest'
import { candidate, createSearchFixture, jsonResponse } from './search-test-fixture'
import { planRaidComparison } from './raid-candidate'
import type { CharacterCandidate } from '../../preload/common/types/character'
import { INITIAL_PORTRAIT_COLOR_POLICY } from './portrait-policy'

vi.mock('./raid-candidate', async (original) => {
  const actual = await original<typeof import('./raid-candidate')>()

  return { ...actual, planRaidComparison: vi.fn(actual.planRaidComparison) }
})

const highest = {
  ...candidate,
  fame: 90000,
  imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/synthetic-character?zoom=1',
  adventureName: null,
  jobName: '프리스트(남)',
  jobGrowName: '眞 크루세이더'
}
const chosen = {
  ...candidate,
  characterId: 'synthetic-chosen',
  serverId: 'bakal',
  serverName: '바칼',
  fame: 1000,
  imageUrl: 'https://img-api.neople.co.kr/df/servers/bakal/characters/synthetic-chosen?zoom=1',
  adventureName: null,
  jobName: '마법사(여)',
  jobGrowName: '眞 엘레멘탈마스터'
}
const raidRow = { jobText: '眞엘레멘탈마스터', valueColumn: 'fame', valueText: '90,000' } as const

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

async function beginRaid() {
  const fixture = await createSearchFixture(false, 'raid', INITIAL_PORTRAIT_COLOR_POLICY)
  // 공대 캡처 회차처럼 게임 창을 등록한 뒤 공대 수명을 시작한다.
  await fixture.invoke('selectCaptureSource', 'window:search-fixture')
  const begun = (await fixture.invoke('controlRaidSearch', { action: 'begin' })) as {
    snapshot: { captureId: string }
  }

  return { fixture, captureId: begun.snapshot.captureId }
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
  vi.mocked(planRaidComparison).mockClear()
})

it('공대 수명의 OCR 관측은 그 행의 직업명과 수치를 식별에 넘기고 직업명이 맞는 후보를 고른다', async () => {
  const { fixture, captureId } = await beginRaid()
  fixture.fetchSearch
    .mockResolvedValueOnce(jsonResponse({ body: { rows: [highest, chosen] } }))
    .mockResolvedValueOnce(jsonResponse({ body: detailsOf(chosen) }))

  await fixture.invoke('notifyRaidOcrCandidatesDetected', { ...ocr(captureId, 4), raidRow })

  await vi.waitFor(async () => expect((await fixture.read()).slots[4].state).toBe('success'))
  const slot = (await fixture.read()).slots[4]
  expect(slot.selected).toMatchObject({ characterId: 'synthetic-chosen', serverId: 'bakal' })
  expect(slot.selectionMethod).toBe('job')
  expect(slot.choices).toBeUndefined()
  expect(planRaidComparison).toHaveBeenCalledExactlyOnceWith({
    observed: {
      jobText: '眞엘레멘탈마스터',
      valueColumn: 'fame',
      value: { min: 90_000, max: 90_000 }
    },
    candidates: [highest, chosen]
  })
})

it('직업명을 보내지 않는 이전 API 응답이면 동명 후보 전체에서 명성으로 고른다', async () => {
  const { fixture, captureId } = await beginRaid()
  const legacy = [highest, chosen].map(
    ({ jobName: _jobName, jobGrowName: _jobGrowName, ...row }) => row
  )
  fixture.fetchSearch
    .mockResolvedValueOnce(jsonResponse({ body: { rows: legacy } }))
    .mockResolvedValueOnce(jsonResponse({ body: detailsOf(highest) }))

  await fixture.invoke('notifyRaidOcrCandidatesDetected', { ...ocr(captureId, 2), raidRow })

  await vi.waitFor(async () => expect((await fixture.read()).slots[2].state).toBe('success'))
  const slot = (await fixture.read()).slots[2]
  expect(slot.selected).toMatchObject({ characterId: 'synthetic-character' })
  expect(slot.selectionMethod).toBe('fame')
})

it.each([
  ['공대 행 값이 없는 관측', (captureId: string) => ocr(captureId, 1)],
  [
    '수치 표기에 다른 문자가 섞인 관측',
    (captureId: string) => ({ ...ocr(captureId, 1), raidRow: { ...raidRow, valueText: '9O,000' } })
  ],
  [
    '알 수 없는 수치 열 종류',
    (captureId: string) => ({ ...ocr(captureId, 1), raidRow: { ...raidRow, valueColumn: 'level' } })
  ],
  [
    '공대 행 값에 정하지 않은 필드가 있는 관측',
    (captureId: string) => ({ ...ocr(captureId, 1), raidRow: { ...raidRow, server: 'cain' } })
  ]
])('공대 수명은 %s을 받지 않는다', async (_case, observation) => {
  const { fixture, captureId } = await beginRaid()

  expect(
    await fixture.invoke('notifyRaidOcrCandidatesDetected', observation(captureId))
  ).toMatchObject({ ok: false, error: { code: 'INVALID_SEARCH_COMMAND' } })
  expect(fixture.fetchSearch).not.toHaveBeenCalled()
})

it('파티 캡처의 OCR 이름은 공대 비교를 쓰지 않고 공대 행 값도 받지 않는다', async () => {
  const fixture = await createSearchFixture(false, 'capture', INITIAL_PORTRAIT_COLOR_POLICY)
  expect(
    await fixture.invoke('notifyOcrCandidatesDetected', { ...ocr(fixture.captureId, 1), raidRow })
  ).toMatchObject({ ok: false, error: { code: 'INVALID_SEARCH_COMMAND' } })
  fixture.fetchSearch
    .mockResolvedValueOnce(jsonResponse({ body: { rows: [highest, chosen] } }))
    .mockResolvedValueOnce(jsonResponse({ body: detailsOf(highest) }))

  await fixture.invoke('notifyOcrCandidatesDetected', ocr(fixture.captureId, 1))

  await vi.waitFor(async () => expect((await fixture.read()).slots[1].state).toBe('success'))
  expect(planRaidComparison).not.toHaveBeenCalled()
})

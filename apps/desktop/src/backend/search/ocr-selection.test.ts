import { describe, expect, it, vi } from 'vitest'
import type { CharacterDetails } from '../../preload/common/types/character'
import type { IdentificationAdapters } from './request'
import { createCaptureSearchLifetime } from './capture-lifetime'
import { FakeMonotonicClock } from '../lib/fake-monotonic-clock'
import { INITIAL_PORTRAIT_COLOR_POLICY } from './portrait-policy'

const details: CharacterDetails = {
  character: {
    characterId: 'character',
    serverId: 'cain',
    serverName: '카인',
    characterName: '가나'
  },
  status: { status: [], buff: null },
  equipment: { equipment: [], setItemInfo: [] },
  avatar: null,
  creature: null,
  oath: null,
  mistAssimilation: null,
  skillStyle: null,
  buff: { equipment: null, avatar: null, creature: null },
  sections: {},
  freshness: {
    lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z',
    expiresAt: '2026-10-07T00:05:00.000Z'
  }
}

describe('OCR로 고른 캐릭터의 카드 요약', () => {
  it('이전 API가 함께 보내던 카드 값은 버리고 역할만 메인 카드 요약에 넘긴다', async () => {
    // 지금 배포된 API의 카드 응답 모양이다. 새 Desktop은 역할만 읽는다.
    const card = {
      role: 'dealer',
      stats: null,
      score: null,
      serverRank: null,
      set: null,
      oath: null,
      investment: [
        {
          slotId: 'WEAPON',
          slotName: '무기',
          itemId: 'weapon-item',
          itemName: '무기 이름',
          rarity: '태초',
          exclusive: false,
          reinforce: { kind: 'reinforce', value: 12, amplificationName: null },
          enchant: null
        }
      ]
    } as const
    const identification: IdentificationAdapters = {
      candidates: async () => [
        {
          ...details.character,
          fame: 50000,
          imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/character?zoom=1',
          adventureName: null,
          jobName: null,
          jobGrowName: null
        }
      ],
      image: async () => ({ width: 1, height: 1, rgba: new Uint8Array([1, 2, 3, 255]) }),
      details: async () => ({ ...details, card }),
      scorePortrait: async () => null,
      selection: INITIAL_PORTRAIT_COLOR_POLICY
    }
    const lifetime = createCaptureSearchLifetime({
      publish: vi.fn(),
      isCurrent: () => true,
      runtime: { http: vi.fn(), clock: new FakeMonotonicClock(), identification }
    })
    const captureId = lifetime.begin({ windowGeneration: 1, sourceGeneration: 1 }).snapshot
      .captureId!
    lifetime.observeOcr({
      captureId,
      slot: 0,
      observationRevision: 1,
      nickname: '가나',
      candidateNicknames: ['가나'],
      portrait: {
        image: { width: 1, height: 1, rgba: new Uint8Array([1, 2, 3, 255]) },
        rasterScale: 1
      }
    })
    await vi.waitFor(() => expect(lifetime.snapshot().slots[0].state).toBe('success'))

    expect(lifetime.snapshot().slots[0].selected?.card).toEqual({ role: 'dealer', score: null })
    expect(lifetime.snapshot().slots[0]).not.toHaveProperty('details')
    lifetime.invalidate()
  })
})

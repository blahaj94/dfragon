import { describe, expect, it, vi } from 'vitest'
import type { CharacterDetails } from '../../preload/common/types/character'
import type { SearchRuntime } from './request'
import { createCaptureSearchLifetime } from './capture-lifetime'
import { FakeClock } from '../auth/auth-test-fixtures'

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

describe('선택 상세의 main 전용 보관 수명', () => {
  it.each(['clear', 'end', '새 입력', '권한 만료'] as const)(
    '%s는 상세 접근을 무효화한다',
    async (reset) => {
      let current = true
      const identify = vi.fn<NonNullable<SearchRuntime['identify']>>().mockResolvedValue({
        kind: 'success',
        value: {
          kind: 'matched',
          nickname: '가나',
          details,
          candidate: {
            ...details.character,
            fame: 50000,
            imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/character?zoom=1'
          }
        }
      })
      const lifetime = createCaptureSearchLifetime({
        publish: vi.fn(),
        isCurrent: () => current,
        runtime: { http: vi.fn(), clock: new FakeClock(), identify }
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
      const requestId = lifetime.snapshot().slots[0].requestId!
      const identity = { captureId, slot: 0, requestId }
      expect(lifetime.selection(identity)).toBe(details)
      expect(lifetime.selection({ ...identity, requestId: 'stale' })).toBeNull()
      expect(lifetime.selection({ ...identity, slot: -1 })).toBeNull()
      expect(lifetime.selection({ ...identity, captureId: 'stale' })).toBeNull()
      expect(lifetime.snapshot().slots[0]).not.toHaveProperty('details')
      if (reset === 'clear') {
        lifetime.clear({ action: 'clear', captureId, slot: 0, observationRevision: 2 })
      } else if (reset === 'end') {
        lifetime.end(captureId)
      } else if (reset === '새 입력') {
        lifetime.observeOcr({
          captureId,
          slot: 0,
          observationRevision: 2,
          nickname: '다라',
          candidateNicknames: ['다라'],
          portrait: null
        })
      } else {
        current = false
      }
      expect(lifetime.selection(identity)).toBeNull()
      lifetime.invalidate()
    }
  )
})

import { CharacterDetailFailure, characterDetailFailure } from '../details/errors.js'
import type { CharacterIdentity } from '../identity.js'
import { SearchAdmission, searchClock } from '../search-admission.js'
import { SearchDeadline } from '../search-deadline.js'
import type { SearchClock } from '../types.js'
import type { FetchCharacterAppearance } from './neople.js'
import type { CharacterAppearance } from './project.js'

// 네 슬롯에서 OCR 이름 두 개의 여덟 서버 후보까지 조회할 수 있는 별도 IP 한도다.
export const CHARACTER_APPEARANCE_CAPACITY = 64

export interface CharacterAppearanceDependencies {
  readonly fetchAppearance: FetchCharacterAppearance
  readonly clock?: SearchClock
}

export function createCharacterAppearanceService(dependencies: CharacterAppearanceDependencies) {
  const deps = Object.freeze({ ...dependencies })
  const clock = deps.clock ?? searchClock
  const admission = new SearchAdmission(clock, { capacity: CHARACTER_APPEARANCE_CAPACITY })
  const shutdown = new AbortController()
  const active = new Set<Promise<CharacterAppearance>>()

  async function respond(
    peerAddress: string | undefined,
    identity: CharacterIdentity,
    requestSignal: AbortSignal
  ): Promise<CharacterAppearance> {
    const signal = AbortSignal.any([requestSignal, shutdown.signal])
    if (!peerAddress || signal.aborted) {
      throw new CharacterDetailFailure('internal')
    }
    const deadline = new SearchDeadline(clock, signal)
    let lease: Awaited<ReturnType<SearchAdmission['acquire']>> | undefined
    try {
      lease = await deadline.wait(admission.acquire(peerAddress, deadline.signal))
      deadline.check()
      lease.reserve()
      // Quota 소유권만 놓고 연결 취소 신호는 공급자 body 소비가 끝날 때까지 유지한다.
      lease.release()
      deadline.dispose()

      const appearance = await deps.fetchAppearance(identity, signal)
      signal.throwIfAborted()

      return appearance
    } catch (error) {
      throw characterDetailFailure(error)
    } finally {
      lease?.release()
      deadline.dispose()
    }
  }

  return {
    get(peerAddress: string | undefined, identity: CharacterIdentity, signal: AbortSignal) {
      const operation = respond(peerAddress, identity, signal)
      active.add(operation)
      void operation.finally(() => active.delete(operation)).catch(() => undefined)

      return operation
    },
    async onModuleDestroy() {
      shutdown.abort()
      admission.close()
      await Promise.allSettled(active)
    }
  }
}

export type CharacterAppearanceService = ReturnType<typeof createCharacterAppearanceService>

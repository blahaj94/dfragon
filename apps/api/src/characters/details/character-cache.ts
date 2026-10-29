import { LRUCache } from 'lru-cache'
import type { NeopleStage, NeopleStageTimings, RecordNeopleStage } from './neople-stages.js'
import type { CharacterIdentity, FetchedCharacterPayloads } from './sections.js'

export const CHARACTER_CACHE_TTL_MS = 60 * 60 * 1000
// One character keeps about 35KB of raw sections plus the detail service's stored response (about 150KB), so
// 1,000 characters stay near 185MB. A 2026-10-30 production load test (#870) held
// RSS near 300MB with this cache full, against a container limit the operator reports as about 4GB.
const CHARACTER_CACHE_MAX_CHARACTERS = 1_000

export type FetchCharacter = (
  identity: CharacterIdentity,
  signal: AbortSignal,
  recordStage: RecordNeopleStage
) => Promise<FetchedCharacterPayloads>

export type LoadCharacter = (
  identity: CharacterIdentity,
  signal: AbortSignal,
  timings: NeopleStageTimings
) => Promise<FetchedCharacterPayloads>

interface SharedFetch {
  controller: AbortController
  promise: Promise<FetchedCharacterPayloads>
  waiters: number
  settled: boolean
  stages: Map<NeopleStage, number>
  timings: Set<NeopleStageTimings>
}

// lru-cache's fetchMethod reports Neople stages only to the first caller and cancels a shared
// fetch only through delete(), which would also drop the value a failed refresh must keep.
export function createCharacterCache(fetchCharacter: FetchCharacter) {
  const fetched = new LRUCache<string, FetchedCharacterPayloads>({
    max: CHARACTER_CACHE_MAX_CHARACTERS,
    ttl: CHARACTER_CACHE_TTL_MS
  })
  const inFlight = new Map<string, SharedFetch>()
  const pending = new Set<SharedFetch>()
  let closed = false

  const start = (key: string, identity: CharacterIdentity): SharedFetch => {
    const controller = new AbortController()
    const stages = new Map<NeopleStage, number>()
    const stageTimings = new Set<NeopleStageTimings>()
    const recordStage: RecordNeopleStage = (stage, durationMs) => {
      stages.set(stage, durationMs)
      for (const waiter of stageTimings) {
        waiter.record(stage, durationMs)
      }
    }
    const sharedFetch: SharedFetch = {
      controller,
      promise: Promise.resolve()
        .then(() => fetchCharacter(identity, controller.signal, recordStage))
        .then((result) => {
          // A fetch abandoned by every waiter or by shutdown must not overwrite the cache late.
          controller.signal.throwIfAborted()
          fetched.set(key, result)

          return result
        }),
      waiters: 0,
      settled: false,
      stages,
      timings: stageTimings
    }
    inFlight.set(key, sharedFetch)
    pending.add(sharedFetch)
    sharedFetch.promise
      .finally(() => {
        sharedFetch.settled = true
        if (inFlight.get(key) === sharedFetch) {
          inFlight.delete(key)
        }
        pending.delete(sharedFetch)
      })
      .catch(() => undefined)

    return sharedFetch
  }

  // One process shares overlapping fetches; a caller disconnect must not cancel other callers.
  const join = async (
    identity: CharacterIdentity,
    signal: AbortSignal,
    timings: NeopleStageTimings
  ): Promise<FetchedCharacterPayloads> => {
    const key = cacheKey(identity)
    let sharedFetch = inFlight.get(key)
    if (!sharedFetch || sharedFetch.controller.signal.aborted) {
      sharedFetch = start(key, identity)
    } else {
      timings.markShared()
    }
    const shared = sharedFetch
    shared.waiters++
    // A caller that joins late still reports the stages that finished before it arrived.
    for (const [stage, durationMs] of shared.stages) {
      timings.record(stage, durationMs)
    }
    shared.timings.add(timings)
    let cancel: () => void = () => undefined
    try {
      return await new Promise<FetchedCharacterPayloads>((resolve, reject) => {
        cancel = () => reject(new Error('Character fetch canceled'))
        signal.addEventListener('abort', cancel, { once: true })
        shared.promise.then(resolve, reject)
        if (signal.aborted) {
          cancel()
        }
      })
    } finally {
      signal.removeEventListener('abort', cancel)
      shared.timings.delete(timings)
      shared.waiters--
      if (shared.waiters === 0 && !shared.settled) {
        shared.controller.abort()
      }
    }
  }

  const ensureOpen = (signal: AbortSignal) => {
    signal.throwIfAborted()
    if (closed) {
      throw new Error('Character cache closed')
    }
  }

  const get: LoadCharacter = async (identity, signal, timings) => {
    ensureOpen(signal)
    const cached = fetched.get(cacheKey(identity))
    if (cached !== undefined) {
      return cached
    }

    return join(identity, signal, timings)
  }

  // A failed refresh leaves the previous entry untouched because only a successful fetch writes it.
  const refresh: LoadCharacter = async (identity, signal, timings) => {
    ensureOpen(signal)

    return join(identity, signal, timings)
  }

  return {
    get,
    refresh,
    async close() {
      closed = true
      const fetches = [...pending]
      for (const sharedFetch of fetches) {
        sharedFetch.controller.abort()
      }
      await Promise.allSettled(fetches.map((sharedFetch) => sharedFetch.promise))
    }
  }
}

function cacheKey(identity: CharacterIdentity): string {
  return JSON.stringify([identity.serverId, identity.characterId])
}

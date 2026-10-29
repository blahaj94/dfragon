import type { NeopleStage, NeopleStageTimings, RecordNeopleStage } from './neople-stages.js'
import type { CharacterIdentity, FetchedCharacterPayloads } from './sections.js'

interface SharedFetch {
  controller: AbortController
  promise: Promise<FetchedCharacterPayloads>
  waiters: number
  settled: boolean
  stages: Map<NeopleStage, number>
  timings: Set<NeopleStageTimings>
}

// One process shares overlapping fetches; a caller disconnect must not cancel other callers.
export class SharedCharacterFetches {
  private readonly byCharacter = new Map<string, SharedFetch>()
  private readonly pending = new Set<SharedFetch>()
  private closed = false

  async run(
    identity: CharacterIdentity,
    signal: AbortSignal,
    timings: NeopleStageTimings,
    work: (signal: AbortSignal, recordStage: RecordNeopleStage) => Promise<FetchedCharacterPayloads>
  ): Promise<FetchedCharacterPayloads> {
    signal.throwIfAborted()
    if (this.closed) {
      throw new Error('Character fetches closed')
    }
    const key = JSON.stringify([identity.serverId, identity.characterId])
    let sharedFetch = this.byCharacter.get(key)
    if (!sharedFetch || sharedFetch.controller.signal.aborted) {
      const controller = new AbortController()
      const stages = new Map<NeopleStage, number>()
      const stageTimings = new Set<NeopleStageTimings>()
      const recordStage: RecordNeopleStage = (stage, durationMs) => {
        stages.set(stage, durationMs)
        for (const waiter of stageTimings) {
          waiter.record(stage, durationMs)
        }
      }
      sharedFetch = {
        controller,
        promise: Promise.resolve().then(() => work(controller.signal, recordStage)),
        waiters: 0,
        settled: false,
        stages,
        timings: stageTimings
      }
      const owned = sharedFetch
      this.byCharacter.set(key, owned)
      this.pending.add(owned)
      owned.promise
        .finally(() => {
          owned.settled = true
          if (this.byCharacter.get(key) === owned) {
            this.byCharacter.delete(key)
          }
          this.pending.delete(owned)
        })
        .catch(() => undefined)
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

  async close() {
    this.closed = true
    const pending = [...this.pending]
    for (const sharedFetch of pending) {
      sharedFetch.controller.abort()
    }
    await Promise.allSettled(pending.map((sharedFetch) => sharedFetch.promise))
  }
}

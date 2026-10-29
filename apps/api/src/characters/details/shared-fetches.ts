import type { CharacterIdentity, FetchedCharacterPayloads } from './sections.js'

interface SharedFetch {
  controller: AbortController
  promise: Promise<FetchedCharacterPayloads>
  waiters: number
  settled: boolean
}

// One process shares overlapping fetches; a caller disconnect must not cancel other callers.
export class SharedCharacterFetches {
  private readonly byCharacter = new Map<string, SharedFetch>()
  private readonly pending = new Set<SharedFetch>()
  private closed = false

  async run(
    identity: CharacterIdentity,
    signal: AbortSignal,
    work: (signal: AbortSignal) => Promise<FetchedCharacterPayloads>
  ): Promise<FetchedCharacterPayloads> {
    signal.throwIfAborted()
    if (this.closed) {
      throw new Error('Character fetches closed')
    }
    const key = JSON.stringify([identity.serverId, identity.characterId])
    let sharedFetch = this.byCharacter.get(key)
    if (!sharedFetch || sharedFetch.controller.signal.aborted) {
      const controller = new AbortController()
      sharedFetch = {
        controller,
        promise: Promise.resolve().then(() => work(controller.signal)),
        waiters: 0,
        settled: false
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
    }
    const shared = sharedFetch
    shared.waiters++
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

import type { CharacterApiResponse } from '../../database/schemas/character-api-responses.js'
import type { CharacterIdentity } from './sections.js'

interface Refresh {
  controller: AbortController
  promise: Promise<CharacterApiResponse[]>
  waiters: number
  settled: boolean
}

// One process shares overlapping refreshes; a caller disconnect must not cancel other callers.
export class CharacterRefreshes {
  private readonly byCharacter = new Map<string, Refresh>()
  private readonly pending = new Set<Refresh>()
  private closed = false

  async run(
    identity: CharacterIdentity,
    signal: AbortSignal,
    work: (signal: AbortSignal) => Promise<CharacterApiResponse[]>
  ): Promise<CharacterApiResponse[]> {
    signal.throwIfAborted()
    if (this.closed) {
      throw new Error('Character refreshes closed')
    }
    const key = JSON.stringify([identity.serverId, identity.characterId])
    let refresh = this.byCharacter.get(key)
    if (!refresh || refresh.controller.signal.aborted) {
      const controller = new AbortController()
      refresh = {
        controller,
        promise: Promise.resolve().then(() => work(controller.signal)),
        waiters: 0,
        settled: false
      }
      const owned = refresh
      this.byCharacter.set(key, owned)
      this.pending.add(owned)
      void owned.promise
        .finally(() => {
          owned.settled = true
          if (this.byCharacter.get(key) === owned) {
            this.byCharacter.delete(key)
          }
          this.pending.delete(owned)
        })
        .catch(() => undefined)
    }
    const shared = refresh
    shared.waiters++
    let cancel: () => void = () => undefined
    try {
      return await new Promise<CharacterApiResponse[]>((resolve, reject) => {
        cancel = () => reject(new Error('Character refresh canceled'))
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
    for (const refresh of pending) {
      refresh.controller.abort()
    }
    await Promise.allSettled(pending.map((refresh) => refresh.promise))
  }
}

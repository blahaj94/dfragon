import { searchClock } from '../search-admission.js'
import { SearchDeadline } from '../search-deadline.js'
import { CharacterDetailFailure, characterDetailFailure } from './errors.js'
import type { FetchCharacterDetails } from './neople.js'
import { projectCharacterDetails } from './project.js'
import type { CharacterIdentity } from './sections.js'
import type { CharacterDetailStore } from './store.js'
import { enrichCharacterDetails } from '../catalog/enrich.js'
import { characterFreshness, CHARACTER_REFRESH_COOLDOWN_MS } from './freshness.js'
import { CharacterRefreshes } from './refreshes.js'
import type { CatalogService } from '../catalog/service.js'
import { enchantGrades } from '../card/enchant-grades.js'
import { projectCharacterCard } from '../card/project.js'

export interface CharacterDetailDependencies {
  store: CharacterDetailStore
  fetchDetails: FetchCharacterDetails
  catalog?: CatalogService
}

export { parseCharacterIdentity } from '../identity.js'

// A slow or failed ranking only hides serverRank; the caller still ends a canceled request.
async function readServerRank(
  store: CharacterDetailStore,
  identity: CharacterIdentity,
  signal: AbortSignal
) {
  try {
    return await store.readServerRank(identity, signal)
  } catch {
    return null
  }
}

export function createCharacterDetailService(deps: CharacterDetailDependencies) {
  const adapter = deps.fetchDetails
  const shutdown = new AbortController()
  const active = new Set<Promise<unknown>>()

  const refreshes = new CharacterRefreshes()
  const respond = async (
    peerAddress: string | undefined,
    identity: CharacterIdentity,
    requestSignal: AbortSignal,
    forceRefresh: boolean
  ) => {
    const signal = AbortSignal.any([requestSignal, shutdown.signal])
    try {
      if (!peerAddress || signal.aborted) {
        throw new CharacterDetailFailure('internal')
      }
      let rows
      if (!forceRefresh) {
        const snapshot = await deps.store.read(identity, signal)
        signal.throwIfAborted()
        const freshness = characterFreshness(snapshot.rows)
        if (
          freshness &&
          Date.parse(freshness.lastSuccessfulFetchAt) <= snapshot.now.getTime() &&
          snapshot.now.getTime() < Date.parse(freshness.expiresAt)
        ) {
          rows = snapshot.rows
        }
      }

      if (!rows) {
        rows = await refreshes.run(identity, signal, async (refreshSignal) => {
          refreshSignal.throwIfAborted()
          const startDeadline = new SearchDeadline(searchClock, refreshSignal)
          let requestedAt: string
          try {
            if (forceRefresh) {
              const snapshot = await startDeadline.wait(deps.store.read(identity, refreshSignal))
              const freshness = characterFreshness(snapshot.rows)
              const fetchedAt = freshness ? Date.parse(freshness.lastSuccessfulFetchAt) : NaN
              const remaining = fetchedAt + CHARACTER_REFRESH_COOLDOWN_MS - snapshot.now.getTime()
              if (fetchedAt <= snapshot.now.getTime() && remaining > 0) {
                throw new CharacterDetailFailure('limited', {
                  retryAfter: Math.ceil(remaining / 1000)
                })
              }
            }
            requestedAt = await startDeadline.wait(deps.store.beginFetch())
          } finally {
            startDeadline.dispose()
          }
          refreshSignal.throwIfAborted()
          const payloads = await adapter(identity, refreshSignal)
          refreshSignal.throwIfAborted()

          return deps.store.saveAndRead(identity, payloads, requestedAt, refreshSignal)
        })
      }
      signal.throwIfAborted()
      const projected = projectCharacterDetails(identity, rows)
      const freshness = characterFreshness(rows)
      if (!freshness) {
        throw new CharacterDetailFailure('internal')
      }
      const serverRank = await readServerRank(deps.store, identity, signal)
      signal.throwIfAborted()
      const card = projectCharacterCard(projected, serverRank, enchantGrades)
      const details = deps.catalog
        ? await enrichCharacterDetails(projected, deps.catalog, signal)
        : projected
      signal.throwIfAborted()

      return { ...details, freshness, card }
    } catch (error) {
      throw characterDetailFailure(error)
    }
  }

  function request(
    peerAddress: string | undefined,
    identity: CharacterIdentity,
    signal: AbortSignal,
    forceRefresh: boolean
  ) {
    const operation = respond(peerAddress, identity, signal, forceRefresh)
    active.add(operation)
    void operation.finally(() => active.delete(operation)).catch(() => undefined)

    return operation
  }

  return {
    get(peerAddress: string | undefined, identity: CharacterIdentity, signal: AbortSignal) {
      return request(peerAddress, identity, signal, false)
    },
    refresh(peerAddress: string | undefined, identity: CharacterIdentity, signal: AbortSignal) {
      return request(peerAddress, identity, signal, true)
    },
    async onModuleDestroy() {
      shutdown.abort()
      await Promise.allSettled([...active, refreshes.close()])
    }
  }
}

export type CharacterDetailService = ReturnType<typeof createCharacterDetailService>

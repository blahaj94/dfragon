import { NEOPLE_SERVER_NAMES } from '../../constants/neople-character-search.js'
import { SearchAdmission, searchClock } from '../search-admission.js'
import { SearchDeadline } from '../search-deadline.js'
import { CharacterDetailFailure, characterDetailFailure } from './errors.js'
import { createNeopleCharacterDetails } from './neople.js'
import type { FetchCharacterDetails } from './neople.js'
import { projectCharacterDetails } from './project.js'
import type { CharacterIdentity } from './sections.js'
import type { CharacterDetailStore } from './store.js'
import { enrichCharacterDetails } from '../catalog/enrich.js'
import { characterFreshness } from './freshness.js'
import { CharacterRefreshes } from './refreshes.js'
import type { CatalogService } from '../catalog/service.js'

export interface CharacterDetailDependencies {
  apiKey: string
  store: CharacterDetailStore
  fetchDetails?: FetchCharacterDetails
  catalog?: CatalogService
}

export function parseCharacterIdentity(
  serverId: unknown,
  characterId: unknown,
  originalUrl: string
): CharacterIdentity {
  if (
    typeof serverId !== 'string' ||
    !NEOPLE_SERVER_NAMES.has(serverId) ||
    typeof characterId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,256}$/.test(characterId) ||
    originalUrl.includes('?')
  ) {
    throw new CharacterDetailFailure('query')
  }
  return { serverId, characterId }
}

export function createCharacterDetailService(deps: CharacterDetailDependencies) {
  const admission = new SearchAdmission()
  const adapter = deps.fetchDetails ?? createNeopleCharacterDetails(deps.apiKey)
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
    const deadline = new SearchDeadline(searchClock, signal)
    let lease: Awaited<ReturnType<SearchAdmission['acquire']>> | undefined
    try {
      if (!peerAddress || !deps.apiKey.trim() || signal.aborted) {
        throw new CharacterDetailFailure('internal')
      }
      lease = await deadline.wait(admission.acquire(peerAddress, deadline.signal))
      lease.reserve()
      lease.release()
      deadline.dispose()
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
      const details = deps.catalog
        ? await enrichCharacterDetails(projected, deps.catalog, signal)
        : projected
      signal.throwIfAborted()
      return { ...details, freshness }
    } catch (error) {
      throw characterDetailFailure(error)
    } finally {
      lease?.release()
      deadline.dispose()
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
      admission.close()
      await Promise.allSettled([...active, refreshes.close()])
    }
  }
}

export type CharacterDetailService = ReturnType<typeof createCharacterDetailService>

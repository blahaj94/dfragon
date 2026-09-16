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

  const refresh = async (
    peerAddress: string | undefined,
    identity: CharacterIdentity,
    requestSignal: AbortSignal
  ) => {
    const signal = AbortSignal.any([requestSignal, shutdown.signal])
    const deadline = new SearchDeadline(searchClock, signal)
    let lease: Awaited<ReturnType<SearchAdmission['acquire']>> | undefined
    try {
      if (!peerAddress || !deps.apiKey.trim() || signal.aborted) {
        throw new CharacterDetailFailure('internal')
      }
      lease = await deadline.wait(admission.acquire(peerAddress, deadline.signal))
      lease.assertCapacity()
      const requestedAt = await deadline.wait(deps.store.beginFetch())
      deadline.check()
      lease.reserve()
      const upstream = adapter(identity, signal)
      lease.release()
      deadline.dispose()
      const payloads = await upstream
      signal.throwIfAborted()
      const rows = await deps.store.saveAndRead(identity, payloads, requestedAt, signal)
      const projected = projectCharacterDetails(identity, rows)
      return deps.catalog
        ? await enrichCharacterDetails(projected, deps.catalog, signal)
        : projected
    } catch (error) {
      throw characterDetailFailure(error)
    } finally {
      lease?.release()
      deadline.dispose()
    }
  }

  return {
    refresh(peerAddress: string | undefined, identity: CharacterIdentity, signal: AbortSignal) {
      const operation = refresh(peerAddress, identity, signal)
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

export type CharacterDetailService = ReturnType<typeof createCharacterDetailService>

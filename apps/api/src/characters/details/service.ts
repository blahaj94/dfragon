import { CharacterDetailFailure, characterDetailFailure } from './errors.js'
import type { FetchCharacterDetails } from './neople.js'
import { projectCharacterDetails, projectCharacterFreshness } from './project.js'
import type { CharacterIdentity, FetchedCharacterPayloads } from './sections.js'
import { enrichCharacterDetails, hasUnavailableItemDetail } from '../catalog/enrich.js'
import { type LoadCharacter, createCharacterCache } from './character-cache.js'
import { type NeopleStageTimings, elapsedMs } from './neople-stages.js'
import type { CatalogService } from '../catalog/service.js'
import { projectCharacterCard } from '../card/project.js'
import {
  type CharacterDetailBody,
  prepareBrotli,
  serializeCharacterDetail
} from './response-body.js'

export interface CharacterDetailResponse {
  body: CharacterDetailBody
  reused: boolean
}

export interface CharacterDetailDependencies {
  fetchDetails: FetchCharacterDetails
  catalog: CatalogService
}

export { parseCharacterIdentity } from '../identity.js'

export function createCharacterDetailService(deps: CharacterDetailDependencies) {
  const adapter = deps.fetchDetails
  const shutdown = new AbortController()
  const active = new Set<Promise<unknown>>()

  const characters = createCharacterCache(async (identity, fetchSignal, recordStage) => {
    fetchSignal.throwIfAborted()
    const payloads = await adapter(identity, fetchSignal, recordStage)
    const fetchedAt = new Date()

    return { payloads, fetchedAt }
  })
  // Keyed by the cached character object, a body lives exactly as long as that cache entry: an expired,
  // evicted or refreshed entry takes its body and any brotli finished after the swap with it.
  const bodies = new WeakMap<FetchedCharacterPayloads, CharacterDetailBody>()
  const respond = async (
    identity: CharacterIdentity,
    requestSignal: AbortSignal,
    timings: NeopleStageTimings,
    loadCharacter: LoadCharacter
  ): Promise<CharacterDetailResponse> => {
    const signal = AbortSignal.any([requestSignal, shutdown.signal])
    try {
      if (signal.aborted) {
        throw new CharacterDetailFailure('internal')
      }
      const character = await loadCharacter(identity, signal, timings)
      signal.throwIfAborted()
      const reusable = bodies.get(character)
      if (reusable !== undefined) {
        return { body: reusable, reused: true }
      }
      const { payloads, fetchedAt } = character
      const projected = projectCharacterDetails(identity, payloads, fetchedAt)
      const freshness = projectCharacterFreshness(fetchedAt)
      const card = projectCharacterCard(projected)
      const catalogStartedAt = performance.now()
      const details = await enrichCharacterDetails(projected, deps.catalog, signal)
      timings.record('catalog', elapsedMs(catalogStartedAt))
      signal.throwIfAborted()
      const body = serializeCharacterDetail({ ...details, freshness, card })
      // An unavailable item stays out of the stored body so the next request looks it up again.
      if (!bodies.has(character) && !hasUnavailableItemDetail(details)) {
        bodies.set(character, body)
        prepareBrotli(body)
      }

      return { body, reused: false }
    } catch (error) {
      throw characterDetailFailure(error)
    }
  }
  const track = <T>(operation: Promise<T>): Promise<T> => {
    active.add(operation)
    operation.finally(() => active.delete(operation)).catch(() => undefined)

    return operation
  }

  return {
    get(identity: CharacterIdentity, signal: AbortSignal, timings: NeopleStageTimings) {
      return track(respond(identity, signal, timings, characters.get))
    },
    refresh(identity: CharacterIdentity, signal: AbortSignal, timings: NeopleStageTimings) {
      return track(respond(identity, signal, timings, characters.refresh))
    },
    async onModuleDestroy() {
      shutdown.abort()
      await Promise.allSettled([...active, characters.close(), deps.catalog.close()])
    }
  }
}

export type CharacterDetailService = ReturnType<typeof createCharacterDetailService>

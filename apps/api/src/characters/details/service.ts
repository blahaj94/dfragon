import { CharacterDetailFailure, characterDetailFailure } from './errors.js'
import type { FetchCharacterDetails } from './neople.js'
import { projectCharacterDetails, projectCharacterFreshness } from './project.js'
import type { CharacterIdentity } from './sections.js'
import { enrichCharacterDetails } from '../catalog/enrich.js'
import { type LoadCharacter, createCharacterCache } from './character-cache.js'
import { type NeopleStageTimings, elapsedMs } from './neople-stages.js'
import type { CatalogService } from '../catalog/service.js'
import { projectCharacterCard } from '../card/project.js'

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
  const respond = async (
    identity: CharacterIdentity,
    requestSignal: AbortSignal,
    timings: NeopleStageTimings,
    loadCharacter: LoadCharacter
  ) => {
    const signal = AbortSignal.any([requestSignal, shutdown.signal])
    try {
      if (signal.aborted) {
        throw new CharacterDetailFailure('internal')
      }
      const { payloads, fetchedAt } = await loadCharacter(identity, signal, timings)
      signal.throwIfAborted()
      const projected = projectCharacterDetails(identity, payloads, fetchedAt)
      const freshness = projectCharacterFreshness(fetchedAt)
      const card = projectCharacterCard(projected)
      const catalogStartedAt = performance.now()
      const details = await enrichCharacterDetails(projected, deps.catalog, signal)
      timings.record('catalog', elapsedMs(catalogStartedAt))
      signal.throwIfAborted()

      return { ...details, freshness, card }
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

import { CharacterDetailFailure, characterDetailFailure } from './errors.js'
import type { FetchCharacterDetails } from './neople.js'
import { projectCharacterDetails, projectCharacterFreshness } from './project.js'
import type { CharacterIdentity } from './sections.js'
import { enrichCharacterDetails } from '../catalog/enrich.js'
import { SharedCharacterFetches } from './shared-fetches.js'
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

  const fetches = new SharedCharacterFetches()
  const respond = async (
    identity: CharacterIdentity,
    requestSignal: AbortSignal,
    timings: NeopleStageTimings
  ) => {
    const signal = AbortSignal.any([requestSignal, shutdown.signal])
    try {
      if (signal.aborted) {
        throw new CharacterDetailFailure('internal')
      }
      const { payloads, fetchedAt } = await fetches.run(
        identity,
        signal,
        timings,
        async (fetchSignal, recordStage) => {
          fetchSignal.throwIfAborted()
          const payloads = await adapter(identity, fetchSignal, recordStage)
          fetchSignal.throwIfAborted()
          const fetchedAt = new Date()

          return { payloads, fetchedAt }
        }
      )
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

  return {
    get(identity: CharacterIdentity, signal: AbortSignal, timings: NeopleStageTimings) {
      const operation = respond(identity, signal, timings)
      active.add(operation)
      operation.finally(() => active.delete(operation)).catch(() => undefined)

      return operation
    },
    async onModuleDestroy() {
      shutdown.abort()
      await Promise.allSettled([...active, fetches.close()])
    }
  }
}

export type CharacterDetailService = ReturnType<typeof createCharacterDetailService>

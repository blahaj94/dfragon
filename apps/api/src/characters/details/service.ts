import { CharacterDetailFailure, characterDetailFailure } from './errors.js'
import type { FetchCharacterDetails } from './neople.js'
import { projectCharacterDetails, projectCharacterFreshness } from './project.js'
import type { CharacterIdentity } from './sections.js'
import { enrichCharacterDetails } from '../catalog/enrich.js'
import { SharedCharacterFetches } from './shared-fetches.js'
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
    peerAddress: string | undefined,
    identity: CharacterIdentity,
    requestSignal: AbortSignal
  ) => {
    const signal = AbortSignal.any([requestSignal, shutdown.signal])
    try {
      if (!peerAddress || signal.aborted) {
        throw new CharacterDetailFailure('internal')
      }
      const { payloads, fetchedAt } = await fetches.run(identity, signal, async (fetchSignal) => {
        fetchSignal.throwIfAborted()
        const payloads = await adapter(identity, fetchSignal)
        fetchSignal.throwIfAborted()
        const fetchedAt = new Date()

        return { payloads, fetchedAt }
      })
      signal.throwIfAborted()
      const projected = projectCharacterDetails(identity, payloads, fetchedAt)
      const freshness = projectCharacterFreshness(fetchedAt)
      const card = projectCharacterCard(projected)
      const details = await enrichCharacterDetails(projected, deps.catalog, signal)
      signal.throwIfAborted()

      return { ...details, freshness, card }
    } catch (error) {
      throw characterDetailFailure(error)
    }
  }

  return {
    get(peerAddress: string | undefined, identity: CharacterIdentity, signal: AbortSignal) {
      const operation = respond(peerAddress, identity, signal)
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

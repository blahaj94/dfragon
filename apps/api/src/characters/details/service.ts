import { CharacterDetailFailure, characterDetailFailure } from './errors.js'
import type { FetchCharacterDetails } from './neople.js'
import { projectCharacterDetails } from './project.js'
import { characterDetailSections } from './sections.js'
import type { CharacterIdentity, CharacterSectionResponse } from './sections.js'
import { enrichCharacterDetails } from '../catalog/enrich.js'
import { characterFreshness } from './freshness.js'
import { SharedCharacterFetches } from './shared-fetches.js'
import type { CatalogService } from '../catalog/service.js'
import { enchantGrades } from '../card/enchant-grades.js'
import { exclusiveItems } from '../card/exclusive-items.js'
import { projectCharacterCard } from '../card/project.js'

export interface CharacterDetailDependencies {
  fetchDetails: FetchCharacterDetails
  catalog?: CatalogService
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
      // 저장하지 않으므로 모든 요청이 Neople에서 새로 받는다. 같은 캐릭터의 동시 요청만 한 번으로 묶는다.
      const rows = await fetches.run(identity, signal, async (fetchSignal) => {
        fetchSignal.throwIfAborted()
        const payloads = await adapter(identity, fetchSignal)
        fetchSignal.throwIfAborted()
        const fetchedAt = new Date()

        return characterDetailSections.map(
          (section): CharacterSectionResponse => ({
            section,
            payload: payloads[section],
            revision: 1,
            contentUpdatedAt: fetchedAt,
            lastSuccessfulFetchAt: fetchedAt
          })
        )
      })
      signal.throwIfAborted()
      const projected = projectCharacterDetails(identity, rows)
      const freshness = characterFreshness(rows)
      if (!freshness) {
        throw new CharacterDetailFailure('internal')
      }
      // 서버 내 순위는 저장한 캐릭터끼리 비교하던 값이라 DB 없이는 계산하지 않는다.
      const card = projectCharacterCard(projected, null, enchantGrades, exclusiveItems)
      const details = deps.catalog
        ? await enrichCharacterDetails(projected, deps.catalog, signal)
        : projected
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
      void operation.finally(() => active.delete(operation)).catch(() => undefined)

      return operation
    },
    async onModuleDestroy() {
      shutdown.abort()
      await Promise.allSettled([...active, fetches.close()])
    }
  }
}

export type CharacterDetailService = ReturnType<typeof createCharacterDetailService>

import { createCatalogService } from '../characters/catalog/service.js'
import { createNeopleCatalog } from '../characters/catalog/neople.js'
import { createNeopleCharacterSearch } from '../characters/neople-character-search.js'
import { createNeopleCharacterDetails } from '../characters/details/neople.js'
import { createApiHttpApp } from '../http.js'
import type { readRuntimeConfiguration } from './configuration.js'

type RuntimeConfiguration = Awaited<ReturnType<typeof readRuntimeConfiguration>>

export function createApiRuntime(configuration: RuntimeConfiguration) {
  return createApiHttpApp(
    {
      searchCharacters: createNeopleCharacterSearch(configuration.apiKey),
      trustedProxyHops: configuration.trustedProxyHops
    },
    {
      fetchDetails: createNeopleCharacterDetails(configuration.apiKey),
      catalog: createCatalogService(createNeopleCatalog(configuration.apiKey))
    },
    configuration.localHttps
  )
}

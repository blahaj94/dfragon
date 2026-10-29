import { createCatalogService } from '../characters/catalog/service.js'
import { createNeopleCatalog } from '../characters/catalog/neople.js'
import { createNeopleCharacterSearch } from '../characters/neople-character-search.js'
import { createNeopleCharacterDetails } from '../characters/details/neople.js'
import { createNeopleShopGrade } from '../today-grade/neople.js'
import { createApiHttpApp } from '../http.js'
import type { readRuntimeConfiguration } from './configuration.js'

type RuntimeConfiguration = Awaited<ReturnType<typeof readRuntimeConfiguration>>

export function createApiRuntime(configuration: RuntimeConfiguration) {
  return createApiHttpApp({
    search: { searchCharacters: createNeopleCharacterSearch(configuration.apiKey) },
    details: {
      fetchDetails: createNeopleCharacterDetails(configuration.apiKey),
      catalog: createCatalogService(createNeopleCatalog(configuration.apiKey))
    },
    todayGrade: { fetchShopGrade: createNeopleShopGrade(configuration.apiKey) },
    trustedProxyHops: configuration.trustedProxyHops,
    httpsOptions: configuration.localHttps
  })
}

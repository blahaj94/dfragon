import { createCatalogService } from '../characters/catalog/service.js'
import { createNeopleCatalog } from '../characters/catalog/neople.js'
import { createNeopleCharacterSearch } from '../characters/neople-character-search.js'
import { createNeopleCharacterDetails } from '../characters/details/neople.js'
import { createApiHttpApp } from '../http.js'
import type { readRuntimeConfiguration } from './configuration.js'

type RuntimeConfiguration = Awaited<ReturnType<typeof readRuntimeConfiguration>>

/** 이번 실행이 소유한 앱의 종료 책임을 관리한다. */
export async function createApiRuntime(configuration: RuntimeConfiguration) {
  const app = await createApiHttpApp(
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
  let closing: Promise<void> | undefined
  const close = (): Promise<void> => {
    closing ??= app.close().catch(() => {
      throw new Error('API runtime cleanup failed')
    })

    return closing
  }

  return { app, close }
}

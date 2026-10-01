import { parseServerBuildInfo } from '@dfragon/lib'
import { fetchApi } from '../api-fetch'
import { validateApiOrigin } from '../auth/protocol'
import { readJson } from '../auth/http-response'
import type {
  BuildVersionService,
  BuildVersions,
  ServerVersion
} from '../../preload/common/types/build-versions'

const VERSION_TIMEOUT_MS = 4_000

export function createServerVersionReader({
  apiOrigin,
  accountsOrigin,
  fetch: transport = fetchApi
}: {
  apiOrigin: string | null
  accountsOrigin: string | null
  fetch?: typeof fetch
}): () => Promise<BuildVersions['servers']> {
  const origins = { api: apiOrigin, accounts: accountsOrigin, ocr: 'https://ocr.dfragon.com' }

  async function read(service: BuildVersionService): Promise<ServerVersion> {
    const configuredOrigin = origins[service]
    if (configuredOrigin == null) {

      return { status: 'unavailable' }
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), VERSION_TIMEOUT_MS)
    let response: Response | undefined
    try {
      const origin = validateApiOrigin(configuredOrigin)
      const url = `${origin}/version`
      response = await transport(url, {
        method: 'GET',
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      })
      if (
        controller.signal.aborted ||
        response.redirected ||
        (response.url && response.url !== url)
      ) {

        return { status: 'unavailable' }
      }
      if (response.status === 404) {

        return { status: 'unsupported' }
      }
      if (response.status !== 200) {

        return { status: 'unavailable' }
      }
      const parsed = parseServerBuildInfo(await readJson(response, controller.signal), service)
      if (parsed == null || controller.signal.aborted) {

        return { status: 'unavailable' }
      }

      return { status: 'available', commit: parsed.commit }
    } catch {

      return { status: 'unavailable' }
    } finally {
      clearTimeout(timeout)
      void response?.body?.cancel().catch(() => undefined)
    }
  }

  return async () => {
    const [api, accounts, ocr] = await Promise.all([read('api'), read('accounts'), read('ocr')])

    return { api, accounts, ocr }
  }
}

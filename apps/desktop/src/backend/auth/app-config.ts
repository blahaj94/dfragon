import { join } from 'node:path'
import development from '../../../build/development-auth.json'
import { validateApiOrigin } from './protocol'
import { readAuthRuntimeConfig, type AuthRuntimeConfig } from './runtime-config'

declare const __LDB_DEVELOPMENT_AUTH__: boolean

export function readAppAuthConfig(application: {
  getPath(name: 'appData'): string
}): AuthRuntimeConfig | null {
  const isDevelopmentBuild =
    typeof __LDB_DEVELOPMENT_AUTH__ !== 'undefined' && __LDB_DEVELOPMENT_AUTH__
  if (!isDevelopmentBuild) {
    return readAuthRuntimeConfig()
  }

  // OS protocol launches do not inherit the shell that built or first ran the app.
  // Keep the complete development tuple in the main bundle, including on cold starts.
  return readAuthRuntimeConfig({
    LDB_AUTH_API_ORIGIN: development.apiOrigin,
    LDB_AUTH_RETURN_TARGET: development.returnTarget,
    LDB_AUTH_ENVIRONMENT: development.environment,
    LDB_AUTH_PROVIDERS: development.providers.join(','),
    LDB_AUTH_APP_IDENTITY: development.appIdentity,
    LDB_AUTH_USER_DATA_PATH: join(application.getPath('appData'), development.appIdentity)
  })
}

/** Public search configuration does not require a configured login provider or credential store. */
export function readAppApiOrigin(): string | null {
  const isDevelopmentBuild =
    typeof __LDB_DEVELOPMENT_AUTH__ !== 'undefined' && __LDB_DEVELOPMENT_AUTH__
  const origin = isDevelopmentBuild ? development.apiOrigin : process.env['LDB_AUTH_API_ORIGIN']
  if (origin == null) {
    return null
  }
  try {
    validateApiOrigin(origin)
    return origin
  } catch {
    return null
  }
}

import { join } from 'node:path'
import development from '../../../build/development-auth.json'
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

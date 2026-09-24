import { join } from 'node:path'
import development from '../../../build/development-auth.json'
import distribution from '../../../build/distribution-auth.json'
import { validateApiOrigin } from './protocol'
import { readAuthRuntimeConfig, type AuthRuntimeConfig } from './runtime-config'

declare const __DFRAGON_DEVELOPMENT_AUTH__: boolean
declare const __DFRAGON_DISTRIBUTION_API_ORIGIN__: string | null

export function readAppAuthConfig(application: {
  getPath(name: 'appData'): string
}): AuthRuntimeConfig | null {
  const isDevelopmentBuild =
    typeof __DFRAGON_DEVELOPMENT_AUTH__ !== 'undefined' && __DFRAGON_DEVELOPMENT_AUTH__
  const distributionOrigin =
    typeof __DFRAGON_DISTRIBUTION_API_ORIGIN__ !== 'undefined' ? __DFRAGON_DISTRIBUTION_API_ORIGIN__ : null
  if (!isDevelopmentBuild && distributionOrigin == null) {
    return readAuthRuntimeConfig()
  }

  // OS protocol launches do not inherit the shell that built or first ran the app.
  // Keep the public tuple in the main bundle, including on cold starts.
  const config = isDevelopmentBuild ? development : distribution
  return readAuthRuntimeConfig({
    DFRAGON_AUTH_API_ORIGIN: isDevelopmentBuild ? development.apiOrigin : distributionOrigin!,
    DFRAGON_AUTH_RETURN_TARGET: config.returnTarget,
    DFRAGON_AUTH_ENVIRONMENT: config.environment,
    DFRAGON_AUTH_PROVIDERS: config.providers.join(','),
    DFRAGON_AUTH_APP_IDENTITY: config.appIdentity,
    DFRAGON_AUTH_USER_DATA_PATH: join(application.getPath('appData'), config.appIdentity)
  })
}

/** Public search configuration does not require a configured login provider or credential store. */
export function readAppApiOrigin(): string | null {
  const isDevelopmentBuild =
    typeof __DFRAGON_DEVELOPMENT_AUTH__ !== 'undefined' && __DFRAGON_DEVELOPMENT_AUTH__
  const distributionOrigin =
    typeof __DFRAGON_DISTRIBUTION_API_ORIGIN__ !== 'undefined' ? __DFRAGON_DISTRIBUTION_API_ORIGIN__ : null
  const origin = isDevelopmentBuild
    ? development.apiOrigin
    : (distributionOrigin ?? process.env['DFRAGON_AUTH_API_ORIGIN'])
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

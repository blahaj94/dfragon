import { join } from 'node:path'
import type { DesktopChannel } from './desktop-channel'
import { validateApiOrigin } from './protocol'
import { readAuthRuntimeConfig, type AuthRuntimeConfig } from './runtime-config'

declare const __DFRAGON_CHANNEL__: DesktopChannel | null

/** 채널 빌드만 공개 tuple을 가지며, 개발 실행과 채널 없는 빌드는 process 설정을 읽는다. */
function readBundledChannel(): DesktopChannel | null {
  if (typeof __DFRAGON_CHANNEL__ === 'undefined') {
    return null
  }

  return __DFRAGON_CHANNEL__
}

export function readAppAuthConfig(application: {
  getPath(name: 'appData'): string
}): AuthRuntimeConfig | null {
  const channel = readBundledChannel()
  if (channel == null) {
    return readAuthRuntimeConfig()
  }
  // OS protocol launches do not inherit the shell that built or first ran the app.
  // Keep the public tuple in the main bundle, including on cold starts.
  const { identity } = channel

  return readAuthRuntimeConfig({
    DFRAGON_AUTH_API_ORIGIN: channel.origins.accounts,
    DFRAGON_AUTH_RETURN_TARGET: identity.returnTarget,
    DFRAGON_AUTH_ENVIRONMENT: identity.environment,
    DFRAGON_AUTH_PROVIDERS: identity.providers.join(','),
    DFRAGON_AUTH_APP_IDENTITY: identity.appIdentity,
    DFRAGON_AUTH_USER_DATA_PATH: join(application.getPath('appData'), identity.appIdentity)
  })
}

/** Public search configuration does not require a configured login provider or credential store. */
export function readAppApiOrigin(): string | null {
  const channel = readBundledChannel()
  const origin = channel == null ? process.env['DFRAGON_API_ORIGIN'] : channel.origins.api
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

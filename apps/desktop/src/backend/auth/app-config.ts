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
  // 로그인 복귀 주소는 pending의 loopback 수신기가 정한다.
  // 기존 protocol 값은 OS ingress 제거 전까지 설정에만 남긴다.
  const { auth, appIdentity } = channel.identity
  const accountsOrigin = channel.origins.accounts
  // 로그인 없는 채널은 셸 설정으로도 로그인을 켜지 않는다.
  if (auth == null || accountsOrigin == null) {
    return null
  }

  return readAuthRuntimeConfig({
    DFRAGON_AUTH_API_ORIGIN: accountsOrigin,
    DFRAGON_AUTH_RETURN_TARGET: auth.returnTarget,
    DFRAGON_AUTH_ENVIRONMENT: auth.environment,
    DFRAGON_AUTH_PROVIDERS: auth.providers.join(','),
    DFRAGON_AUTH_APP_IDENTITY: appIdentity,
    DFRAGON_AUTH_USER_DATA_PATH: join(application.getPath('appData'), appIdentity)
  })
}

/** main bundle에 넣은 채널 이름. 개발 실행과 채널 없는 빌드는 null이다. */
export function readAppChannelName(): string | null {
  const channel = readBundledChannel()
  if (channel == null) {
    return null
  }

  return channel.name
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

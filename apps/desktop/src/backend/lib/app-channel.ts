import { validateApiOrigin } from './api-origin'

/** 채널 빌드가 main bundle에 넣는 공개 tuple. 빌드 시 channels.json과 빌드 변수에서 만든다. */
export type DesktopChannel = Readonly<{
  name: string
  identity: Readonly<{ appIdentity: string }>
  origins: Readonly<{ api: string }>
}>

declare const __DFRAGON_CHANNEL__: DesktopChannel | null

/** 채널 빌드만 공개 tuple을 가지며, 개발 실행과 채널 없는 빌드는 process 설정을 읽는다. */
function readBundledChannel(): DesktopChannel | null {
  if (typeof __DFRAGON_CHANNEL__ === 'undefined') {
    return null
  }

  return __DFRAGON_CHANNEL__
}

/** main bundle에 넣은 채널 이름. 개발 실행과 채널 없는 빌드는 null이다. */
export function readAppChannelName(): string | null {
  const channel = readBundledChannel()
  if (channel == null) {
    return null
  }

  return channel.name
}

/** 채널 빌드의 앱 식별자. 채널마다 profile 폴더와 Windows 작업 표시줄 묶음을 나눈다. */
export function readAppIdentity(): string | null {
  const channel = readBundledChannel()
  if (channel == null) {
    return null
  }

  return channel.identity.appIdentity
}

/** 채널 빌드는 빌드에 넣은 검색 origin을, 그 밖의 실행은 `DFRAGON_API_ORIGIN`을 쓴다. */
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

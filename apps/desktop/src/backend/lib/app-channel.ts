import { validateApiOrigin } from './api-origin'

export type DesktopChannel = Readonly<{
  name: string
  identity: Readonly<{ appIdentity: string }>
  origins: Readonly<{ api: string }>
}>

declare const __DFRAGON_CHANNEL__: DesktopChannel | null

function readBundledChannel(): DesktopChannel | null {
  if (typeof __DFRAGON_CHANNEL__ === 'undefined') {
    return null
  }

  return __DFRAGON_CHANNEL__
}

export function readAppChannelName(): string | null {
  const channel = readBundledChannel()
  if (channel == null) {
    return null
  }

  return channel.name
}

export function readAppIdentity(): string | null {
  const channel = readBundledChannel()
  if (channel == null) {
    return null
  }

  return channel.identity.appIdentity
}

/** 채널의 origin은 빌드할 때 검사했으므로 채널 없는 실행의 process 설정만 검사한다. */
export function readAppApiOrigin(): string | null {
  const channel = readBundledChannel()
  if (channel != null) {
    return channel.origins.api
  }
  const origin = process.env['DFRAGON_API_ORIGIN']
  if (origin == null) {
    return null
  }
  try {
    return validateApiOrigin(origin)
  } catch {
    return null
  }
}

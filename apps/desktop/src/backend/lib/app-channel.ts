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

export function readAppApiOrigin(): string | null {
  const channel = readBundledChannel()
  const origin = channel != null ? channel.origins.api : process.env['DFRAGON_API_ORIGIN']
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

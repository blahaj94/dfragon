import { z } from 'zod'
import type { DesktopChannel } from '../src/backend/auth/desktop-channel'
import { validateApiOrigin } from '../src/backend/auth/protocol'
import channelsFile from './channels.json'

const publicTextSchema = z.string().min(1)
const originSourceSchema = z.union([
  publicTextSchema,
  z.strictObject({ variable: publicTextSchema, default: publicTextSchema.optional() })
])
const channelSchema = z.strictObject({
  packaging: z.strictObject({
    productName: publicTextSchema,
    executableName: publicTextSchema,
    packageName: publicTextSchema,
    output: publicTextSchema,
    installerInclude: publicTextSchema.optional(),
    artifactPrefix: publicTextSchema.optional()
  }),
  identity: z.strictObject({
    appIdentity: publicTextSchema,
    auth: z
      .strictObject({
        environment: publicTextSchema,
        providers: z.array(publicTextSchema).min(1)
      })
      .optional()
  }),
  origins: z.strictObject({ api: originSourceSchema, accounts: originSourceSchema.optional() })
})
const channelsSchema = z.strictObject({
  development: channelSchema,
  test: channelSchema,
  distribution: channelSchema
})

export type Channel = z.infer<typeof channelSchema>
export type ChannelName = keyof z.infer<typeof channelsSchema>
export type ChannelOriginKind = keyof Channel['origins']
type BuildEnvironment = Readonly<Record<string, string | undefined>>

// 개발 채널만 localhost 서버를 바라본다. 다른 채널의 고정 origin, default와 빌드 변수 값은 공개 주소여야 한다.
const LOOPBACK_ORIGIN_CHANNEL = 'development' satisfies ChannelName
// electron-vite mode `dfragon-<채널>`이 채널 빌드를 고른다. 그 밖의 mode는 채널 없는 빌드나 개발 실행이다.
const CHANNEL_MODE_PREFIX = 'dfragon-'
// electron-builder의 기본 진입 파일은 이 변수로 채널을 고르고, 비우면 배포 채널을 만든다.
const CHANNEL_ENVIRONMENT_VARIABLE = 'DFRAGON_CHANNEL'
const DEFAULT_PACKAGING_CHANNEL = 'distribution' satisfies ChannelName
const DNS_ROOT_LABEL_PATTERN = /\.$/
const IPV4_MAPPED_LOOPBACK_PATTERN = /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/
const IPV4_LOOPBACK_PATTERN = /^127\.\d+\.\d+\.\d+$/

// CI는 비어 있는 변수도 설정된 값으로 넘기므로 빈 문자열은 미설정으로 본다.
function readConfiguredValue(environment: BuildEnvironment, variable: string): string | null {
  const configured = environment[variable]
  const hasConfiguredValue = configured != null && configured.length > 0
  if (!hasConfiguredValue) {
    return null
  }

  return configured
}

function isLoopbackHostname(hostname: string): boolean {
  // Canonical URL hostnames encode IPv4-mapped IPv6 as ::ffff:hhhh:hhhh.
  const isMappedLoopback = IPV4_MAPPED_LOOPBACK_PATTERN.test(hostname)

  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    IPV4_LOOPBACK_PATTERN.test(hostname) ||
    hostname === '[::1]' ||
    isMappedLoopback
  )
}

function assertPublicOrigin(origin: string, allowsLoopback: boolean): void {
  validateApiOrigin(origin)
  const hostname = new URL(origin).hostname.replace(DNS_ROOT_LABEL_PATTERN, '')
  if (!allowsLoopback && isLoopbackHostname(hostname)) {
    throw new Error()
  }
}

function describeOriginRequirement(allowsLoopback: boolean): string {
  if (allowsLoopback) {
    return 'canonical HTTPS'
  }

  return 'non-loopback canonical HTTPS'
}

function assertPublicChannelValues(name: string, channel: Channel): void {
  const { auth } = channel.identity
  if (auth != null) {
    if (channel.origins.accounts == null) {
      throw new Error(`Set an accounts origin for the ${name} channel, which enables login.`)
    }
  }

  const allowsLoopback = name === LOOPBACK_ORIGIN_CHANNEL
  for (const [kind, source] of Object.entries(channel.origins)) {
    const origin = typeof source === 'string' ? source : source.default
    if (origin == null) {
      continue
    }
    try {
      assertPublicOrigin(origin, allowsLoopback)
    } catch {
      const requirement = describeOriginRequirement(allowsLoopback)
      throw new Error(`Set a ${requirement} ${kind} origin for the ${name} channel.`)
    }
  }
}

export function parseChannels(file: unknown): z.infer<typeof channelsSchema> {
  const parsed = channelsSchema.parse(file)
  for (const [name, channel] of Object.entries(parsed)) {
    assertPublicChannelValues(name, channel)
  }

  return parsed
}

/**
 * 채널별 공개 빌드 값의 단일 원본은 `channels.json`이다.
 * 설치본 main bundle에는 공개 연결 설정만 들어가므로 secret이나 credential은 이 파일에 두지 않는다.
 * 문자열 origin은 파일의 값을 그대로 쓰고, `variable` origin은 빌드 환경변수에서 읽는다.
 */
export const channels = parseChannels(channelsFile)

/** Only public connection settings may cross into the installed main bundle. */
export function readChannelOrigin(
  name: ChannelName,
  kind: ChannelOriginKind,
  environment: BuildEnvironment = process.env
): string {
  const source = channels[name].origins[kind]
  if (source == null) {
    throw new Error(`The ${name} channel has no ${kind} origin.`)
  }
  const isLiteralOrigin = typeof source === 'string'
  if (isLiteralOrigin) {
    return source
  }
  const allowsLoopback = name === LOOPBACK_ORIGIN_CHANNEL
  const origin = readConfiguredValue(environment, source.variable) ?? source.default
  try {
    if (origin == null) {
      throw new Error()
    }
    assertPublicOrigin(origin, allowsLoopback)

    return origin
  } catch {
    // Never echo an invalid value: it may accidentally contain credentials.
    const requirement = describeOriginRequirement(allowsLoopback)
    throw new Error(`Set ${source.variable} to a ${requirement} origin.`)
  }
}

function isChannelName(name: string): name is ChannelName {
  return Object.hasOwn(channels, name)
}

export function readChannelNameFromMode(mode: string): ChannelName | null {
  if (!mode.startsWith(CHANNEL_MODE_PREFIX)) {
    return null
  }
  const name = mode.slice(CHANNEL_MODE_PREFIX.length)
  if (!isChannelName(name)) {
    throw new Error(`Unknown channel mode ${mode}.`)
  }

  return name
}

export function readChannelNameFromEnvironment(
  environment: BuildEnvironment = process.env
): ChannelName {
  const configured = readConfiguredValue(environment, CHANNEL_ENVIRONMENT_VARIABLE)
  if (configured == null) {
    return DEFAULT_PACKAGING_CHANNEL
  }

  if (!isChannelName(configured)) {
    throw new Error(`Unknown channel in ${CHANNEL_ENVIRONMENT_VARIABLE}.`)
  }

  return configured
}

/** 채널 빌드의 main bundle에 넣는 공개 tuple. 빌드 변수 origin은 여기서 한 번 읽는다. */
export function readDesktopChannel(
  name: ChannelName,
  environment: BuildEnvironment = process.env
): DesktopChannel {
  const { identity, origins } = channels[name]
  const api = readChannelOrigin(name, 'api', environment)
  if (origins.accounts == null) {
    return { name, identity, origins: { api } }
  }
  const accounts = readChannelOrigin(name, 'accounts', environment)

  return { name, identity, origins: { api, accounts } }
}

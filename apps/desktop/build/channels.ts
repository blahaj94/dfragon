import { z } from 'zod'
import type { DesktopChannel } from '../src/backend/lib/app-channel'
import { validateApiOrigin } from '../src/backend/lib/api-origin'
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
    artifactPrefix: publicTextSchema
  }),
  identity: z.strictObject({ appIdentity: publicTextSchema }),
  origins: z.strictObject({ api: originSourceSchema }),
  analytics: z
    .strictObject({
      measurementId: z.strictObject({ variable: publicTextSchema }),
      apiSecret: z.strictObject({ variable: publicTextSchema })
    })
    .optional()
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

const LOOPBACK_ORIGIN_CHANNEL = 'development' satisfies ChannelName
const CHANNEL_MODE_PREFIX = 'dfragon-'
const CHANNEL_ENVIRONMENT_VARIABLE = 'DFRAGON_CHANNEL'
const DEFAULT_PACKAGING_CHANNEL = 'distribution' satisfies ChannelName
const DNS_ROOT_LABEL_PATTERN = /\.$/
const IPV4_MAPPED_LOOPBACK_PATTERN = /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/
const IPV4_LOOPBACK_PATTERN = /^127\.\d+\.\d+\.\d+$/
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/
const API_SECRET_PATTERN = /^[\w-]+$/

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
 * 설치본 main bundle에는 공개 연결 설정만 들어가므로 secret이나 credential은 이 파일에 두지 않는다.
 */
export const channels = parseChannels(channelsFile)

export function readChannelOrigin(
  name: ChannelName,
  kind: ChannelOriginKind,
  environment: BuildEnvironment = process.env
): string {
  const source = channels[name].origins[kind]
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

/**
 * 측정 ID와 API secret은 설치본에서 꺼낼 수 있으므로 GA 속성에 이벤트를 넣는 권한만 있는 값이어야 한다.
 */
export function readChannelAnalytics(
  name: ChannelName,
  environment: BuildEnvironment = process.env
): DesktopChannel['analytics'] {
  const source = channels[name].analytics
  if (source == null) {
    return null
  }
  const measurementId = readConfiguredValue(environment, source.measurementId.variable)
  const apiSecret = readConfiguredValue(environment, source.apiSecret.variable)
  if (measurementId == null && apiSecret == null) {
    return null
  }

  // Never echo the values: the API secret must not reach build logs.
  if (measurementId == null || !MEASUREMENT_ID_PATTERN.test(measurementId)) {
    throw new Error(`Set ${source.measurementId.variable} to a GA4 measurement ID.`)
  }

  if (apiSecret == null || !API_SECRET_PATTERN.test(apiSecret)) {
    throw new Error(`Set ${source.apiSecret.variable} to a GA4 Measurement Protocol API secret.`)
  }

  return { measurementId, apiSecret }
}

export function readDesktopChannel(
  name: ChannelName,
  environment: BuildEnvironment = process.env
): DesktopChannel {
  const { identity } = channels[name]
  const api = readChannelOrigin(name, 'api', environment)
  const analytics = readChannelAnalytics(name, environment)

  return { name, identity, origins: { api }, analytics }
}

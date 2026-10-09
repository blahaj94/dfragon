import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { readAuthRuntimeConfig } from '../src/backend/auth/runtime-config'
import { channels, parseChannels, readChannelOrigin, type ChannelName } from './channels'

const CHANNEL_NAMES: readonly ChannelName[] = ['development', 'distribution']

function readProtocolScheme(name: ChannelName): string {
  return new URL(channels[name].identity.returnTarget).protocol.slice(0, -1)
}

const DISTRIBUTION_API_ORIGIN_FAILURE =
  /^Set DFRAGON_DISTRIBUTION_API_ORIGIN to a non-loopback canonical HTTPS origin\.$/
const DISTRIBUTION_ACCOUNTS_ORIGIN_FAILURE =
  /^Set DFRAGON_DISTRIBUTION_ACCOUNTS_ORIGIN to a non-loopback canonical HTTPS origin\.$/

it('승인된 배포, 개발 identity tuple과 packaging 값을 유지한다', () => {
  // Rule desktop-auth-platform의 Windows MVP 배포 구성과 로컬 개발용 등록값이다.
  // 값이 바뀌면 설치된 사용자의 profile 경로와 accounts 서버의 returnUrl이 어긋나고,
  // README의 배포 앱, 기존 개발 앱 표와 Release workflow의 파일명 glob이 어긋난다.
  expect(channels.distribution.identity).toEqual({
    appIdentity: 'dfragon',
    environment: 'production',
    returnTarget: 'dfragon://auth/callback',
    providers: ['passkey']
  })
  expect(channels.development.identity).toEqual({
    appIdentity: 'dfragon.dev',
    environment: 'development',
    returnTarget: 'dfragon.dev://auth/callback',
    providers: ['passkey']
  })
  expect(readProtocolScheme('distribution')).toBe('dfragon')
  expect(readProtocolScheme('development')).toBe('dfragon.dev')
  expect(channels.distribution.packaging).toEqual({
    productName: 'DFragon',
    executableName: 'dfragon',
    packageName: 'dfragon',
    output: 'dist',
    installerInclude: 'build/distribution-installer.nsh'
  })
  expect(channels.development.packaging).toEqual({
    productName: 'DFragon Development',
    executableName: 'dfragon-dev',
    packageName: '@dfragon/desktop',
    output: 'dist/development',
    installerInclude: 'build/development-installer.nsh'
  })
})

it.each(CHANNEL_NAMES)('%s 채널의 tuple은 앱 runtime 설정 검증을 그대로 통과한다', (name) => {
  const { identity } = channels[name]
  const accountsOrigin = readChannelOrigin(name, 'accounts', {})
  const userDataPath = resolve('synthetic-profile', identity.appIdentity)

  expect(
    readAuthRuntimeConfig({
      DFRAGON_AUTH_API_ORIGIN: accountsOrigin,
      DFRAGON_AUTH_RETURN_TARGET: identity.returnTarget,
      DFRAGON_AUTH_ENVIRONMENT: identity.environment,
      DFRAGON_AUTH_PROVIDERS: identity.providers.join(','),
      DFRAGON_AUTH_APP_IDENTITY: identity.appIdentity,
      DFRAGON_AUTH_USER_DATA_PATH: userDataPath
    })
  ).toEqual({
    apiOrigin: accountsOrigin,
    returnTarget: identity.returnTarget,
    environment: identity.environment,
    providers: identity.providers,
    appIdentity: identity.appIdentity,
    userDataPath
  })
})

it('채널끼리 identity, 실행 파일 이름, protocol scheme이 겹치지 않는다', () => {
  const identities = CHANNEL_NAMES.map((name) => channels[name].identity.appIdentity)
  const executables = CHANNEL_NAMES.map((name) => channels[name].packaging.executableName)
  const schemes = CHANNEL_NAMES.map(readProtocolScheme)
  for (const values of [identities, executables, schemes]) {
    expect(new Set(values).size).toBe(values.length)
  }
})

it('채널 파일의 복귀 주소와 고정 origin이 공개 규칙을 어기면 빌드 전에 거절한다', () => {
  const httpOrigin = structuredClone(channels)
  httpOrigin.development.origins.api = 'http://localhost:3443'
  expect(() => parseChannels(httpOrigin)).toThrow(
    /^Set a canonical HTTPS api origin for the development channel\.$/
  )

  const webReturnTarget = structuredClone(channels)
  webReturnTarget.distribution.identity.returnTarget = 'https://dfragon.com/auth/callback'
  expect(() => parseChannels(webReturnTarget)).toThrow(
    /^Set a canonical private return target for the distribution channel\.$/
  )

  const missingProviders = structuredClone(channels)
  missingProviders.distribution.identity.providers = []
  expect(() => parseChannels(missingProviders)).toThrow(/providers/)
})

it('개발 채널만 loopback origin을 두고 다른 채널의 고정 origin, default는 공개 주소여야 한다', () => {
  const loopbackDevelopment = structuredClone(channels)
  loopbackDevelopment.development.origins.accounts = 'https://127.0.0.1:3444'
  expect(() => parseChannels(loopbackDevelopment)).not.toThrow()

  const loopbackDistribution = structuredClone(channels)
  loopbackDistribution.distribution.origins.api = 'https://localhost:3443'
  expect(() => parseChannels(loopbackDistribution)).toThrow(
    /^Set a non-loopback canonical HTTPS api origin for the distribution channel\.$/
  )

  const loopbackDefault = structuredClone(channels)
  loopbackDefault.distribution.origins.accounts = {
    variable: 'DFRAGON_DISTRIBUTION_ACCOUNTS_ORIGIN',
    default: 'https://[::1]:3444'
  }
  expect(() => parseChannels(loopbackDefault)).toThrow(
    /^Set a non-loopback canonical HTTPS accounts origin for the distribution channel\.$/
  )
})

it('개발 채널의 origin은 파일 값이며 배포 변수의 영향을 받지 않는다', () => {
  const environment = {
    DFRAGON_DISTRIBUTION_API_ORIGIN: 'https://api.example.test',
    DFRAGON_DISTRIBUTION_ACCOUNTS_ORIGIN: 'https://accounts.example.test'
  }
  expect(readChannelOrigin('development', 'api', environment)).toBe('https://localhost:3443')
  expect(readChannelOrigin('development', 'accounts', environment)).toBe('https://localhost:3444')
})

it('배포 채널은 명시한 공개 origin 변수만 읽는다', () => {
  expect(
    readChannelOrigin('distribution', 'api', {
      DFRAGON_DISTRIBUTION_API_ORIGIN: 'https://api.example.test',
      DFRAGON_AUTH_API_ORIGIN: 'https://localhost:3443',
      AUTH_CONFIG_FILE: 'server-only.json'
    })
  ).toBe('https://api.example.test')
})

it.each([
  undefined,
  '',
  'http://api.example.test',
  'https://api.example.test/',
  'https://api.example.test/path',
  'https://api.example.test?token=private',
  'https://user:private@api.example.test',
  'https://localhost:3443',
  'https://localhost.:3443',
  'https://game.localhost.:3443',
  'https://127.0.0.1:3443',
  'https://[::1]:3443',
  'https://[::ffff:7f00:0]:3443',
  'https://[::ffff:7f00:1]:3443',
  'https://[::ffff:7fff:ffff]:3443'
])('누락, 잘못된 형식, loopback 배포 origin %s을 값 노출 없이 거절한다', (origin) => {
  expect(() =>
    readChannelOrigin('distribution', 'api', { DFRAGON_DISTRIBUTION_API_ORIGIN: origin })
  ).toThrow(DISTRIBUTION_API_ORIGIN_FAILURE)
})

it.each([
  'https://api.example.test.',
  'https://127.example.test',
  'https://[::ffff:7eff:ffff]',
  'https://[::ffff:8000:0]'
])('canonical non-loopback origin %s은 그대로 둔다', (origin) => {
  expect(
    readChannelOrigin('distribution', 'api', { DFRAGON_DISTRIBUTION_API_ORIGIN: origin })
  ).toBe(origin)
})

it('배포 accounts origin은 검색 origin과 별도로 읽고 기본값을 둔다', () => {
  expect(
    readChannelOrigin('distribution', 'accounts', {
      DFRAGON_DISTRIBUTION_API_ORIGIN: 'https://search.example.test'
    })
  ).toBe('https://accounts.dfragon.com')
  expect(
    readChannelOrigin('distribution', 'accounts', {
      DFRAGON_DISTRIBUTION_ACCOUNTS_ORIGIN: 'https://accounts.example.test'
    })
  ).toBe('https://accounts.example.test')
  expect(() =>
    readChannelOrigin('distribution', 'accounts', {
      DFRAGON_DISTRIBUTION_ACCOUNTS_ORIGIN: 'http://accounts.example.test'
    })
  ).toThrow(DISTRIBUTION_ACCOUNTS_ORIGIN_FAILURE)
})

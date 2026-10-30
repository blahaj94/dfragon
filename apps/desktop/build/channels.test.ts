import { expect, it } from 'vitest'
import {
  channels,
  parseChannels,
  readChannelAnalytics,
  readChannelNameFromEnvironment,
  readChannelNameFromMode,
  readChannelOrigin,
  readDesktopChannel,
  type ChannelName
} from './channels'

const CHANNEL_NAMES: readonly ChannelName[] = ['development', 'test', 'distribution']

// 합성 값이며 실제 GA 속성의 값이 아니다.
const SYNTHETIC_ANALYTICS_ENVIRONMENT = {
  DFRAGON_GA_MEASUREMENT_ID: 'G-SYNTH123',
  DFRAGON_GA_API_SECRET: 'synthetic_Secret-1'
}
const GA_MEASUREMENT_ID_FAILURE = /^Set DFRAGON_GA_MEASUREMENT_ID to a GA4 measurement ID\.$/
const GA_API_SECRET_FAILURE =
  /^Set DFRAGON_GA_API_SECRET to a GA4 Measurement Protocol API secret\.$/
const DISTRIBUTION_API_ORIGIN_FAILURE =
  /^Set DFRAGON_DISTRIBUTION_API_ORIGIN to a non-loopback canonical HTTPS origin\.$/

it('승인된 배포, 개발, test identity tuple과 packaging 값을 유지한다', () => {
  // Windows 배포 구성, 로컬 개발용 등록값과 test 채널 구성이다. 값이 바뀌면 설치된 사용자의 profile 경로가 어긋나고,
  // README의 배포 앱, 기존 개발 앱 표와 Release workflow의 파일명 glob이 어긋난다.
  expect(channels.distribution.identity).toEqual({ appIdentity: 'dfragon' })
  expect(channels.development.identity).toEqual({ appIdentity: 'dfragon.dev' })
  expect(channels.test.identity).toEqual({ appIdentity: 'dfragon.test' })
  expect(channels.distribution.packaging).toEqual({
    productName: '던삐삐',
    executableName: 'dfragon',
    packageName: 'dfragon',
    output: 'dist',
    installerInclude: 'build/distribution-installer.nsh',
    artifactPrefix: 'DFragon'
  })
  expect(channels.development.packaging).toEqual({
    productName: '던삐삐 Development',
    executableName: 'dfragon-dev',
    packageName: '@dfragon/desktop',
    output: 'dist/development',
    installerInclude: 'build/development-installer.nsh',
    artifactPrefix: 'DFragon Development'
  })
  expect(channels.test.packaging).toEqual({
    productName: '던삐삐 Test',
    executableName: 'dfragon-test',
    packageName: 'dfragon-test',
    output: 'dist/test',
    artifactPrefix: 'DFragon-Test'
  })
})

it('채널끼리 identity, 실행 파일 이름이 겹치지 않는다', () => {
  const identities = CHANNEL_NAMES.map((name) => channels[name].identity.appIdentity)
  const executables = CHANNEL_NAMES.map((name) => channels[name].packaging.executableName)
  for (const values of [identities, executables]) {
    expect(new Set(values).size).toBe(values.length)
  }
})

it('채널 파일의 고정 origin이 공개 규칙을 어기면 빌드 전에 거절한다', () => {
  const httpOrigin = structuredClone(channels)
  httpOrigin.development.origins.api = 'http://localhost:3443'
  expect(() => parseChannels(httpOrigin)).toThrow(
    /^Set a canonical HTTPS api origin for the development channel\.$/
  )
})

it('개발 채널만 loopback origin을 두고 다른 채널의 고정 origin, default는 공개 주소여야 한다', () => {
  const loopbackDevelopment = structuredClone(channels)
  loopbackDevelopment.development.origins.api = 'https://127.0.0.1:3443'
  expect(() => parseChannels(loopbackDevelopment)).not.toThrow()

  const loopbackDistribution = structuredClone(channels)
  loopbackDistribution.distribution.origins.api = 'https://localhost:3443'
  expect(() => parseChannels(loopbackDistribution)).toThrow(
    /^Set a non-loopback canonical HTTPS api origin for the distribution channel\.$/
  )

  const loopbackDefault = structuredClone(channels)
  loopbackDefault.distribution.origins.api = {
    variable: 'DFRAGON_DISTRIBUTION_API_ORIGIN',
    default: 'https://[::1]:3443'
  }
  expect(() => parseChannels(loopbackDefault)).toThrow(
    /^Set a non-loopback canonical HTTPS api origin for the distribution channel\.$/
  )
})

it('개발 채널의 origin은 파일 값이며 배포 변수의 영향을 받지 않는다', () => {
  const environment = { DFRAGON_DISTRIBUTION_API_ORIGIN: 'https://api.example.test' }
  expect(readChannelOrigin('development', 'api', environment)).toBe('https://localhost:3443')
})

it('배포 채널은 명시한 공개 origin 변수만 읽는다', () => {
  expect(
    readChannelOrigin('distribution', 'api', {
      DFRAGON_DISTRIBUTION_API_ORIGIN: 'https://api.example.test',
      DFRAGON_API_ORIGIN: 'https://localhost:3443'
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

it('electron-vite mode의 dfragon- 접두어로 채널 빌드를 고르고 모르는 채널은 거절한다', () => {
  expect(readChannelNameFromMode('dfragon-distribution')).toBe('distribution')
  expect(readChannelNameFromMode('dfragon-development')).toBe('development')
  expect(readChannelNameFromMode('development')).toBeNull()
  expect(readChannelNameFromMode('production')).toBeNull()
  expect(readChannelNameFromMode('mvp-preview')).toBeNull()
  expect(() => readChannelNameFromMode('dfragon-staging')).toThrow(
    /^Unknown channel mode dfragon-staging\.$/
  )
})

it('main bundle에 넣는 채널 tuple은 identity와 빌드 시점에 읽은 origin을 담는다', () => {
  expect(
    readDesktopChannel('distribution', {
      DFRAGON_DISTRIBUTION_API_ORIGIN: 'https://api.example.test'
    })
  ).toEqual({
    name: 'distribution',
    identity: channels.distribution.identity,
    origins: { api: 'https://api.example.test' },
    analytics: null
  })
  expect(readDesktopChannel('development', {})).toEqual({
    name: 'development',
    identity: channels.development.identity,
    origins: { api: 'https://localhost:3443' },
    analytics: null
  })
  expect(() => readDesktopChannel('distribution', {})).toThrow(DISTRIBUTION_API_ORIGIN_FAILURE)
})

it('test 채널의 tuple은 빌드 변수와 관계없이 항상 운영 API를 쓴다', () => {
  const expected = {
    name: 'test',
    identity: channels.test.identity,
    origins: { api: 'https://api.dfragon.com' },
    analytics: null
  }
  expect(readDesktopChannel('test', {})).toEqual(expected)
  expect(
    readDesktopChannel('test', {
      DFRAGON_TEST_API_ORIGIN: 'https://api.example.test',
      DFRAGON_DISTRIBUTION_API_ORIGIN: 'https://api.example.test',
      DFRAGON_API_ORIGIN: 'https://localhost:3443',
      ...SYNTHETIC_ANALYTICS_ENVIRONMENT
    })
  ).toEqual(expected)
})

it('배포 채널만 GA 측정 ID와 API secret을 넣고, 둘 다 없으면 사용 통계 없이 빌드한다', () => {
  expect(readChannelAnalytics('distribution', SYNTHETIC_ANALYTICS_ENVIRONMENT)).toEqual({
    measurementId: 'G-SYNTH123',
    apiSecret: 'synthetic_Secret-1'
  })
  expect(
    readChannelAnalytics('distribution', {
      DFRAGON_GA_MEASUREMENT_ID: '',
      DFRAGON_GA_API_SECRET: ''
    })
  ).toBeNull()
  expect(readChannelAnalytics('development', SYNTHETIC_ANALYTICS_ENVIRONMENT)).toBeNull()
})

it.each([
  ['API secret 누락', { DFRAGON_GA_MEASUREMENT_ID: 'G-SYNTH123' }, GA_API_SECRET_FAILURE],
  ['측정 ID 누락', { DFRAGON_GA_API_SECRET: 'synthetic_Secret-1' }, GA_MEASUREMENT_ID_FAILURE],
  [
    '측정 ID 형식 오류',
    { DFRAGON_GA_MEASUREMENT_ID: 'UA-private', DFRAGON_GA_API_SECRET: 'synthetic_Secret-1' },
    GA_MEASUREMENT_ID_FAILURE
  ],
  [
    'API secret 형식 오류',
    { DFRAGON_GA_MEASUREMENT_ID: 'G-SYNTH123', DFRAGON_GA_API_SECRET: 'private secret&x=1' },
    GA_API_SECRET_FAILURE
  ]
])('GA 설정의 %s는 값 노출 없이 빌드를 멈춘다', (_name, environment, failure) => {
  expect(() => readChannelAnalytics('distribution', environment)).toThrow(failure)
})

it('electron-builder 기본 진입 파일은 DFRAGON_CHANNEL로 채널을 고르고 비우면 배포 채널을 만든다', () => {
  expect(readChannelNameFromEnvironment({})).toBe('distribution')
  expect(readChannelNameFromEnvironment({ DFRAGON_CHANNEL: '' })).toBe('distribution')
  expect(readChannelNameFromEnvironment({ DFRAGON_CHANNEL: 'test' })).toBe('test')
  expect(readChannelNameFromEnvironment({ DFRAGON_CHANNEL: 'development' })).toBe('development')
  expect(() => readChannelNameFromEnvironment({ DFRAGON_CHANNEL: 'staging' })).toThrow(
    /^Unknown channel in DFRAGON_CHANNEL\.$/
  )
})

import { afterEach, expect, it, vi } from 'vitest'
import { join, resolve } from 'node:path'
import { readDesktopChannel } from '../../../build/channels'
import { readAppApiOrigin, readAppAuthConfig } from './app-config'

const DISTRIBUTION_BUILD_ENVIRONMENT = {
  DFRAGON_DISTRIBUTION_API_ORIGIN: 'https://api.example.test',
  DFRAGON_DISTRIBUTION_ACCOUNTS_ORIGIN: 'https://accounts.example.test'
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('채널 없는 실행은 process 설정의 검색 origin만 읽고 로그인, credential 설정을 요구하지 않는다', () => {
  vi.stubEnv('DFRAGON_API_ORIGIN', 'https://api.example.test')
  vi.stubEnv('DFRAGON_AUTH_PROVIDERS', '')
  vi.stubEnv('DFRAGON_AUTH_USER_DATA_PATH', '')
  expect(readAppApiOrigin()).toBe('https://api.example.test')
  vi.stubEnv('DFRAGON_API_ORIGIN', 'https://api.example.test/path')
  expect(readAppApiOrigin()).toBeNull()
})

it('배포 설치본은 셸 설정 없이 cold launch해도 빌드에 넣은 검색 origin을 쓴다', () => {
  vi.stubGlobal(
    '__DFRAGON_CHANNEL__',
    readDesktopChannel('distribution', DISTRIBUTION_BUILD_ENVIRONMENT)
  )
  vi.stubEnv('DFRAGON_API_ORIGIN', 'https://shell.example.test')
  vi.stubEnv('DFRAGON_AUTH_API_ORIGIN', 'https://localhost:3443')
  vi.stubEnv('DFRAGON_AUTH_PROVIDERS', '')
  expect(readAppApiOrigin()).toBe('https://api.example.test')
  vi.stubEnv('DFRAGON_API_ORIGIN', undefined)
  vi.stubEnv('DFRAGON_AUTH_API_ORIGIN', undefined)
  expect(readAppApiOrigin()).toBe('https://api.example.test')
})

it('개발 설치본의 검색 origin은 배포 변수와 셸 설정의 영향을 받지 않는다', () => {
  vi.stubGlobal('__DFRAGON_CHANNEL__', readDesktopChannel('development', {}))
  vi.stubEnv('DFRAGON_API_ORIGIN', 'https://shell.example.test')
  vi.stubEnv('DFRAGON_AUTH_API_ORIGIN', 'https://api.example.test')
  expect(readAppApiOrigin()).toBe('https://localhost:3443')
})

it('채널 빌드는 셸의 개발 설정을 상속하지 않고 빌드에 넣은 로그인 origin, 복귀 주소, 전용 profile을 쓴다', () => {
  vi.stubEnv('DFRAGON_AUTH_API_ORIGIN', 'https://localhost:3443')
  vi.stubEnv('DFRAGON_AUTH_RETURN_TARGET', 'dfragon.dev://auth/callback')
  vi.stubEnv('DFRAGON_AUTH_ENVIRONMENT', 'development')
  vi.stubEnv('DFRAGON_AUTH_APP_IDENTITY', 'dfragon.local')
  vi.stubEnv('DFRAGON_AUTH_USER_DATA_PATH', resolve('synthetic-development-profile'))
  const appData = resolve('synthetic-app-data')

  vi.stubGlobal(
    '__DFRAGON_CHANNEL__',
    readDesktopChannel('distribution', DISTRIBUTION_BUILD_ENVIRONMENT)
  )
  expect(readAppAuthConfig({ getPath: () => appData })).toEqual({
    apiOrigin: 'https://accounts.example.test',
    returnTarget: 'dfragon://auth/callback',
    environment: 'production',
    providers: ['passkey'],
    appIdentity: 'dfragon',
    userDataPath: join(appData, 'dfragon')
  })

  vi.stubGlobal('__DFRAGON_CHANNEL__', readDesktopChannel('development', {}))
  expect(readAppAuthConfig({ getPath: () => appData })).toEqual({
    apiOrigin: 'https://localhost:3444',
    returnTarget: 'dfragon.dev://auth/callback',
    environment: 'development',
    providers: ['passkey'],
    appIdentity: 'dfragon.dev',
    userDataPath: join(appData, 'dfragon.dev')
  })
})

it('채널 없는 실행의 로그인 설정은 process 설정 여섯 값에서만 온다', () => {
  vi.stubEnv('DFRAGON_AUTH_API_ORIGIN', 'https://localhost:3444')
  vi.stubEnv('DFRAGON_AUTH_RETURN_TARGET', 'dfragon.dev://auth/callback')
  vi.stubEnv('DFRAGON_AUTH_ENVIRONMENT', 'development')
  vi.stubEnv('DFRAGON_AUTH_PROVIDERS', 'passkey')
  vi.stubEnv('DFRAGON_AUTH_APP_IDENTITY', 'dfragon.local')
  const userDataPath = resolve('synthetic-development-profile')
  vi.stubEnv('DFRAGON_AUTH_USER_DATA_PATH', userDataPath)

  expect(readAppAuthConfig({ getPath: () => resolve('synthetic-app-data') })).toEqual({
    apiOrigin: 'https://localhost:3444',
    returnTarget: 'dfragon.dev://auth/callback',
    environment: 'development',
    providers: ['passkey'],
    appIdentity: 'dfragon.local',
    userDataPath
  })
  vi.stubEnv('DFRAGON_AUTH_PROVIDERS', '')
  expect(readAppAuthConfig({ getPath: () => resolve('synthetic-app-data') })).toBeNull()
})

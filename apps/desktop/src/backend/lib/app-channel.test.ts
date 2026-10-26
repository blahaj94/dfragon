import { afterEach, expect, it, vi } from 'vitest'
import { readDesktopChannel } from '../../../build/channels'
import { readAppApiOrigin, readAppChannelName, readAppIdentity } from './app-channel'

const DISTRIBUTION_BUILD_ENVIRONMENT = {
  DFRAGON_DISTRIBUTION_API_ORIGIN: 'https://api.example.test'
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('채널 없는 실행은 process 설정의 검색 origin을 읽고 잘못된 값은 버린다', () => {
  vi.stubEnv('DFRAGON_API_ORIGIN', 'https://api.example.test')
  expect(readAppApiOrigin()).toBe('https://api.example.test')
  expect(readAppChannelName()).toBeNull()
  expect(readAppIdentity()).toBeNull()
  vi.stubEnv('DFRAGON_API_ORIGIN', 'https://api.example.test/path')
  expect(readAppApiOrigin()).toBeNull()
})

it('배포 설치본은 셸 설정 없이 cold launch해도 빌드에 넣은 검색 origin을 쓴다', () => {
  vi.stubGlobal(
    '__DFRAGON_CHANNEL__',
    readDesktopChannel('distribution', DISTRIBUTION_BUILD_ENVIRONMENT)
  )
  vi.stubEnv('DFRAGON_API_ORIGIN', 'https://shell.example.test')
  expect(readAppApiOrigin()).toBe('https://api.example.test')
  vi.stubEnv('DFRAGON_API_ORIGIN', undefined)
  expect(readAppApiOrigin()).toBe('https://api.example.test')
  expect(readAppChannelName()).toBe('distribution')
  expect(readAppIdentity()).toBe('dfragon')
})

it('개발, test 설치본은 자기 검색 origin과 앱 식별자를 쓴다', () => {
  vi.stubEnv('DFRAGON_API_ORIGIN', 'https://shell.example.test')
  vi.stubGlobal('__DFRAGON_CHANNEL__', readDesktopChannel('development', {}))
  expect(readAppApiOrigin()).toBe('https://localhost:3443')
  expect(readAppIdentity()).toBe('dfragon.dev')
  vi.stubGlobal('__DFRAGON_CHANNEL__', readDesktopChannel('test', {}))
  expect(readAppApiOrigin()).toBe('https://api.dfragon.com')
  expect(readAppIdentity()).toBe('dfragon.test')
})

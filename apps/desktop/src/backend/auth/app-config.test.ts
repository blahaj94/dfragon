import { afterEach, expect, it, vi } from 'vitest'
import { join, resolve } from 'node:path'
import { readAppApiOrigin, readAppAuthConfig } from './app-config'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('public search reads its trusted endpoint without login or credential configuration', () => {
  vi.stubGlobal('__LDB_DEVELOPMENT_AUTH__', false)
  vi.stubEnv('LDB_AUTH_API_ORIGIN', 'https://api.example.test')
  vi.stubEnv('LDB_AUTH_PROVIDERS', '')
  vi.stubEnv('LDB_AUTH_USER_DATA_PATH', '')
  expect(readAppApiOrigin()).toBe('https://api.example.test')
  vi.stubEnv('LDB_AUTH_API_ORIGIN', 'https://api.example.test/path')
  expect(readAppApiOrigin()).toBeNull()
})

it('an installed distribution uses its built endpoint after a cold launch without shell settings', () => {
  vi.stubGlobal('__LDB_DEVELOPMENT_AUTH__', false)
  vi.stubGlobal('__LDB_DISTRIBUTION_API_ORIGIN__', 'https://api.example.test')
  vi.stubEnv('LDB_AUTH_API_ORIGIN', 'https://localhost:3443')
  vi.stubEnv('LDB_AUTH_PROVIDERS', '')
  expect(readAppApiOrigin()).toBe('https://api.example.test')
  vi.stubEnv('LDB_AUTH_API_ORIGIN', undefined)
  expect(readAppApiOrigin()).toBe('https://api.example.test')
})

it('keeps the existing development API independent of distribution configuration', () => {
  vi.stubGlobal('__LDB_DEVELOPMENT_AUTH__', true)
  vi.stubGlobal('__LDB_DISTRIBUTION_API_ORIGIN__', null)
  vi.stubEnv('LDB_AUTH_API_ORIGIN', 'https://api.example.test')
  expect(readAppApiOrigin()).toBe('https://localhost:3443')
})

it('uses the distribution login origin, protocol and private profile without inheriting development settings', () => {
  vi.stubGlobal('__LDB_DEVELOPMENT_AUTH__', false)
  vi.stubGlobal('__LDB_DISTRIBUTION_API_ORIGIN__', 'https://api.example.test')
  vi.stubEnv('LDB_AUTH_API_ORIGIN', 'https://localhost:3443')
  vi.stubEnv('LDB_AUTH_RETURN_TARGET', 'ldb.dev://auth/callback')
  vi.stubEnv('LDB_AUTH_ENVIRONMENT', 'development')
  vi.stubEnv('LDB_AUTH_APP_IDENTITY', 'ldb.dev')
  vi.stubEnv('LDB_AUTH_USER_DATA_PATH', resolve('synthetic-development-profile'))
  const appData = resolve('synthetic-app-data')

  expect(readAppAuthConfig({ getPath: () => appData })).toEqual({
    apiOrigin: 'https://api.example.test',
    returnTarget: 'ldb://auth/callback',
    environment: 'production',
    providers: ['passkey'],
    appIdentity: 'ldb',
    userDataPath: join(appData, 'ldb')
  })

  vi.stubGlobal('__LDB_DEVELOPMENT_AUTH__', true)
  vi.stubGlobal('__LDB_DISTRIBUTION_API_ORIGIN__', null)
  expect(readAppAuthConfig({ getPath: () => appData })).toMatchObject({
    apiOrigin: 'https://localhost:3443',
    returnTarget: 'ldb.dev://auth/callback',
    environment: 'development',
    appIdentity: 'ldb.dev',
    userDataPath: join(appData, 'ldb.dev')
  })
})

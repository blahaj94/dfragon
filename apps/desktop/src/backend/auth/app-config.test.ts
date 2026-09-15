import { afterEach, expect, it, vi } from 'vitest'
import { readAppApiOrigin } from './app-config'

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

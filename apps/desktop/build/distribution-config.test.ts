import { expect, it } from 'vitest'
import { readDistributionApiOrigin } from './distribution-config'

it('selects only the explicit public distribution origin', () => {
  expect(
    readDistributionApiOrigin({
      LDB_DISTRIBUTION_API_ORIGIN: 'https://api.example.test',
      LDB_AUTH_API_ORIGIN: 'https://localhost:3443',
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
  'https://127.0.0.1:3443',
  'https://[::1]:3443'
])('rejects a missing, invalid or loopback distribution origin without exposing it', (origin) => {
  expect(() => readDistributionApiOrigin({ LDB_DISTRIBUTION_API_ORIGIN: origin })).toThrow(
    /^Set LDB_DISTRIBUTION_API_ORIGIN to a non-loopback canonical HTTPS origin\.$/
  )
})

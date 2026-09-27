import { expect, it } from 'vitest'
import { readDistributionApiOrigin, readDistributionAccountsOrigin } from './distribution-config'

it('selects only the explicit public distribution origin', () => {
  expect(
    readDistributionApiOrigin({
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
])('rejects a missing, invalid or loopback distribution origin without exposing it', (origin) => {
  expect(() => readDistributionApiOrigin({ DFRAGON_DISTRIBUTION_API_ORIGIN: origin })).toThrow(
    /^Set DFRAGON_DISTRIBUTION_API_ORIGIN to a non-loopback canonical HTTPS origin\.$/
  )
})

it.each([
  'https://api.example.test.',
  'https://127.example.test',
  'https://[::ffff:7eff:ffff]',
  'https://[::ffff:8000:0]'
])('preserves canonical non-loopback origins', (origin) => {
  expect(readDistributionApiOrigin({ DFRAGON_DISTRIBUTION_API_ORIGIN: origin })).toBe(origin)
})

it('bakes authentication separately from the search origin', () => {
  expect(
    readDistributionAccountsOrigin({
      DFRAGON_DISTRIBUTION_API_ORIGIN: 'https://search.example.test'
    })
  ).toBe('https://accounts.dfragon.com')
  expect(
    readDistributionAccountsOrigin({
      DFRAGON_DISTRIBUTION_ACCOUNTS_ORIGIN: 'https://accounts.example.test'
    })
  ).toBe('https://accounts.example.test')
  expect(() =>
    readDistributionAccountsOrigin({
      DFRAGON_DISTRIBUTION_ACCOUNTS_ORIGIN: 'http://accounts.example.test'
    })
  ).toThrow()
})

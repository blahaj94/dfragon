import assert from 'node:assert/strict'
import test from 'node:test'
import { readRuntimeConfiguration } from '../src/runtime/configuration.js'

const environment = {
  PORT: '3000',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_NAME: 'synthetic',
  DB_USERNAME: 'synthetic',
  DB_PASSWORD: 'synthetic',
  NEOPLE_API_KEY: 'synthetic'
}

test('domain API starts without authentication secrets and ignores retired auth inputs', async () => {
  const baseline = await readRuntimeConfiguration(environment)
  assert.equal(baseline.apiKey, 'synthetic')
  assert.deepEqual(
    await readRuntimeConfiguration({ ...environment, AUTH_CONFIG_FILE: '/missing/auth.json' }),
    baseline
  )
  assert.equal(Object.hasOwn(baseline, 'issueAccessJwt'), false)
  await assert.rejects(
    readRuntimeConfiguration({ ...environment, NEOPLE_API_KEY: '' }),
    /Invalid API runtime configuration/
  )
})

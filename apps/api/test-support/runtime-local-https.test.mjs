import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import test from 'node:test'
import { readRuntimeConfiguration } from '../dist/runtime/configuration.js'
import {
  assertStartupFailure,
  authenticationConfiguration,
  collectRuntimeExit,
  runtimeEnvironment,
  startRuntime,
  stopRuntime,
  withRuntimeConfiguration
} from './runtime-fixtures.mjs'

const localConfiguration = authenticationConfiguration()
localConfiguration.passkey.apiOrigin = 'https://localhost:3443'
localConfiguration.passkey.rpId = 'localhost'

test('local HTTPS rejects incomplete, empty, relative, unreadable and invalid TLS inputs', async (t) => {
  await withRuntimeConfiguration(async ({ path }) => {
    const invalidPem = `${path}.pem`
    await writeFile(invalidPem, 'fixture-invalid-tls-material', { mode: 0o600 })
    const cases = [
      { LOCAL_HTTPS_CERT_FILE: invalidPem },
      { LOCAL_HTTPS_KEY_FILE: invalidPem },
      { LOCAL_HTTPS_CERT_FILE: '', LOCAL_HTTPS_KEY_FILE: '' },
      { LOCAL_HTTPS_CERT_FILE: 'relative.pem', LOCAL_HTTPS_KEY_FILE: invalidPem },
      { LOCAL_HTTPS_CERT_FILE: invalidPem, LOCAL_HTTPS_KEY_FILE: 'relative.pem' },
      { LOCAL_HTTPS_CERT_FILE: `${path}.missing`, LOCAL_HTTPS_KEY_FILE: invalidPem },
      { LOCAL_HTTPS_CERT_FILE: invalidPem, LOCAL_HTTPS_KEY_FILE: invalidPem }
    ]
    for (const [index, tls] of cases.entries()) {
      await t.test(`invalid TLS input ${index + 1}`, async () => {
        await assert.rejects(
          readRuntimeConfiguration({ ...runtimeEnvironment(path, 3443), ...tls }),
          new Error('Invalid API runtime configuration')
        )
      })
    }
  }, localConfiguration)
})

test('invalid local HTTPS material fails before database initialization without leaking paths', async () => {
  await withRuntimeConfiguration(async ({ path }) => {
    const invalidPem = `${path}.pem`
    await writeFile(invalidPem, 'fixture-invalid-tls-material', { mode: 0o600 })
    const runtime = startRuntime({
      ...runtimeEnvironment(path, 3443),
      LOCAL_HTTPS_CERT_FILE: invalidPem,
      LOCAL_HTTPS_KEY_FILE: invalidPem
    })
    try {
      assertStartupFailure(await collectRuntimeExit(runtime))
      assert.deepEqual(runtime.events, [])
    } finally {
      await stopRuntime(runtime)
    }
  }, localConfiguration)
})

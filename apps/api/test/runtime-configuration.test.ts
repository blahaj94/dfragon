import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

test('runtime secrets accept explicit files and reject ambiguous or unreadable inputs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'api-secret-input-'))
  try {
    const file = join(directory, 'secret')
    await writeFile(file, 'synthetic-file-secret\n')
    for (const name of ['DB_PASSWORD', 'NEOPLE_API_KEY']) {
      const fileName = `${name}_FILE`
      const configuration = await readRuntimeConfiguration({
        ...environment,
        [name]: undefined,
        [fileName]: file
      })
      assert.equal(
        name === 'DB_PASSWORD' ? configuration.database.password : configuration.apiKey,
        'synthetic-file-secret'
      )
      for (const candidate of [
        { [name]: 'synthetic-secret', [fileName]: file },
        { [name]: '', [fileName]: file },
        { [name]: '' },
        { [name]: undefined, [fileName]: '' },
        { [name]: undefined, [fileName]: 'relative-secret-path' },
        { [name]: undefined, [fileName]: `${file}.missing` },
        { [name]: undefined, [fileName]: directory }
      ]) {
        await assert.rejects(
          readRuntimeConfiguration({ ...environment, ...candidate }),
          new Error('Invalid API runtime configuration')
        )
      }
    }
    for (const contents of ['', ' \n', Buffer.from([0xff])]) {
      await writeFile(file, contents)
      await assert.rejects(
        readRuntimeConfiguration({
          ...environment,
          DB_PASSWORD: undefined,
          DB_PASSWORD_FILE: file
        }),
        new Error('Invalid API runtime configuration')
      )
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

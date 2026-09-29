import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { readApiBuildInfo } from '../src/build-info.js'
import { createApiHttpApp } from '../src/http.js'

const commit = '1234567890abcdef1234567890abcdef12345678'

test('API reads only valid image metadata and reports missing or malformed metadata as unknown', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-api-version-'))
  const path = join(directory, 'build-info.json')
  try {
    assert.deepEqual(await readApiBuildInfo(path), { service: 'api', commit: null })
    for (const content of [
      '{',
      JSON.stringify({ service: 'accounts', commit }),
      JSON.stringify({ service: 'api', commit: commit.slice(0, 7) }),
      JSON.stringify({ service: 'api', commit, branch: 'main' })
    ]) {
      await writeFile(path, content)
      assert.deepEqual(await readApiBuildInfo(path), { service: 'api', commit: null })
    }
    await writeFile(path, JSON.stringify({ service: 'api', commit }))
    assert.deepEqual(await readApiBuildInfo(path), { service: 'api', commit })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('API version is public, uncached and fixed at startup without changing existing routes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-api-version-http-'))
  const path = join(directory, 'build-info.json')
  await writeFile(path, JSON.stringify({ service: 'api', commit }))
  const app = await createApiHttpApp(
    { apiKey: 'version-fixture' },
    undefined,
    undefined,
    undefined,
    path
  )
  try {
    await app.listen(0, '127.0.0.1')
    const origin = await app.getUrl()
    await writeFile(path, JSON.stringify({ service: 'api', commit: 'f'.repeat(40) }))
    const response = await fetch(`${origin}/version`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), { service: 'api', commit })
    assert.deepEqual(await (await fetch(`${origin}/health`)).json(), { status: 'ok' })
    assert.equal((await fetch(`${origin}/me`)).status, 404)
    assert.equal((await fetch(`${origin}/characters`)).status, 400)
  } finally {
    await app.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test('API version endpoint identifies the service when an older image has no metadata', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-api-version-old-'))
  const app = await createApiHttpApp(
    { apiKey: 'version-fixture' },
    undefined,
    undefined,
    undefined,
    join(directory, 'missing.json')
  )
  try {
    await app.listen(0, '127.0.0.1')
    const response = await fetch(`${await app.getUrl()}/version`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { service: 'api', commit: null })
  } finally {
    await app.close()
    await rm(directory, { recursive: true, force: true })
  }
})

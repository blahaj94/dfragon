import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { DataSource } from 'typeorm'
import { readAccountsBuildInfo } from '../src/build-info.js'
import { createLoginHttpApp } from '../src/auth/login/http.js'

const commit = '1234567890abcdef1234567890abcdef12345678'
const unused = async (): Promise<never> => {
  throw new Error('version must not call authentication or the database')
}

test('accounts reads only valid image metadata and reports missing or malformed metadata as unknown', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-accounts-version-'))
  const path = join(directory, 'build-info.json')
  try {
    assert.deepEqual(await readAccountsBuildInfo(path), { service: 'accounts', commit: null })
    for (const content of [
      '{',
      JSON.stringify({ service: 'api', commit }),
      JSON.stringify({ service: 'accounts', commit: commit.slice(0, 7) }),
      JSON.stringify({ service: 'accounts', commit, branch: 'main' })
    ]) {
      await writeFile(path, content)
      assert.deepEqual(await readAccountsBuildInfo(path), { service: 'accounts', commit: null })
    }
    await writeFile(path, JSON.stringify({ service: 'accounts', commit }))
    assert.deepEqual(await readAccountsBuildInfo(path), { service: 'accounts', commit })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('accounts version is public and uncached while existing account and login boundaries remain', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-accounts-version-http-'))
  const path = join(directory, 'build-info.json')
  await writeFile(path, JSON.stringify({ service: 'accounts', commit }))
  const app = await createLoginHttpApp(
    { create: unused, exchange: unused, authorize: unused, manage: unused, browser: unused },
    { refresh: unused, logout: unused },
    { dataSource: new DataSource({ type: 'postgres' }), verifyAccessJwt: unused },
    undefined,
    undefined,
    path
  )
  try {
    await app.listen(0, '127.0.0.1')
    const origin = await app.getUrl()
    await writeFile(path, JSON.stringify({ service: 'accounts', commit: 'f'.repeat(40) }))
    const response = await fetch(`${origin}/version`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), { service: 'accounts', commit })
    assert.equal((await fetch(`${origin}/me`)).status, 401)
    assert.equal(
      (await fetch(`${origin}/auth/login-requests`, { method: 'POST', body: '{}' })).status,
      415
    )
  } finally {
    await app.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test('accounts version endpoint reports damaged image metadata as unknown', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-accounts-version-damaged-'))
  const path = join(directory, 'build-info.json')
  await writeFile(path, JSON.stringify({ service: 'api', commit }))
  const app = await createLoginHttpApp(
    { create: unused, exchange: unused, authorize: unused, manage: unused, browser: unused },
    undefined,
    undefined,
    undefined,
    undefined,
    path
  )
  try {
    await app.listen(0, '127.0.0.1')
    const response = await fetch(`${await app.getUrl()}/version`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { service: 'accounts', commit: null })
  } finally {
    await app.close()
    await rm(directory, { recursive: true, force: true })
  }
})

import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { readApiBuildInfo } from '../src/build-info.js'
import { createApiHttpApp } from '../src/http.js'

const commit = '1234567890abcdef1234567890abcdef12345678'

test('API 이미지 메타데이터는 유효한 값만 읽고 누락·오류는 commit null로 반환한다', async () => {
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

test('공개 version 응답은 캐시하지 않고 시작 시점 값을 유지하며 기존 route를 제공한다', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-api-version-http-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
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
  }
})

test('이전 이미지에 메타데이터가 없어도 version 응답은 API 서비스를 식별한다', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-api-version-old-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
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
  }
})

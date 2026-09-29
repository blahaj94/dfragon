import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { OcrAuth } from '../src/auth.js'
import { readOcrBuildInfo } from '../src/build-info.js'
import { createOcrApp } from '../src/server.js'
import { OcrStore } from '../src/store.js'

const commit = '1234567890abcdef1234567890abcdef12345678'
const config = {
  origin: 'https://ocr.example.test',
  authOrigin: 'https://accounts.example.test',
  ownerId: '00000000-0000-4000-8000-000000000001'
}

test('OCR reads only valid image metadata and reports missing or malformed metadata as unknown', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-ocr-version-'))
  const path = join(directory, 'build-info.json')
  try {
    assert.deepEqual(await readOcrBuildInfo(path), { service: 'ocr', commit: null })
    for (const content of [
      '{',
      JSON.stringify({ service: 'accounts', commit }),
      JSON.stringify({ service: 'ocr', commit: commit.slice(0, 7) }),
      JSON.stringify({ service: 'ocr', commit, branch: 'main' })
    ]) {
      await writeFile(path, content)
      assert.deepEqual(await readOcrBuildInfo(path), { service: 'ocr', commit: null })
    }
    await writeFile(path, JSON.stringify({ service: 'ocr', commit }))
    assert.deepEqual(await readOcrBuildInfo(path), { service: 'ocr', commit })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('OCR version is public and uncached while data authentication and Origin boundaries remain', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-ocr-version-http-'))
  const path = join(directory, 'build-info.json')
  await writeFile(path, JSON.stringify({ service: 'ocr', commit }))
  const store = new OcrStore(':memory:', 1024 * 1024)
  const request = async (): Promise<never> => {
    throw new Error('version must not call the accounts server')
  }
  const runtime = await createOcrApp(config, store, new OcrAuth(config, request), path)
  try {
    await runtime.app.listen(0, '127.0.0.1')
    const origin = await runtime.app.getUrl()
    await writeFile(path, JSON.stringify({ service: 'ocr', commit: 'f'.repeat(40) }))
    const response = await fetch(`${origin}/version`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), { service: 'ocr', commit })
    assert.deepEqual(await (await fetch(`${origin}/health`)).json(), { ok: true })
    assert.equal((await fetch(`${origin}/api/stats`)).status, 401)
    assert.equal((await fetch(`${origin}/api/version`)).status, 401)
    assert.equal((await fetch(`${origin}/auth/logout`, { method: 'POST' })).status, 403)
  } finally {
    await runtime.close()
    store.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test('OCR version endpoint identifies the service when an older image has no metadata', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-ocr-version-old-'))
  const store = new OcrStore(':memory:', 1024 * 1024)
  const runtime = await createOcrApp(config, store, undefined, join(directory, 'missing.json'))
  try {
    await runtime.app.listen(0, '127.0.0.1')
    const response = await fetch(`${await runtime.app.getUrl()}/version`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { service: 'ocr', commit: null })
  } finally {
    await runtime.close()
    store.close()
    await rm(directory, { recursive: true, force: true })
  }
})

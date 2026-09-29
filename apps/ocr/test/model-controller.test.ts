import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { OcrModelController } from '../src/model-controller.js'
import { OcrStore } from '../src/store.js'
import { BASE_MODEL_ARTIFACTS, BASE_MODEL_ID, registerBaseModel } from '../src/base-model.js'

test('base model retries share a download and integrity failure permits a later retry without storing bytes', async (context) => {
  const store = new OcrStore(':memory:', 1024 * 1024)
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let calls = 0
  context.mock.method(globalThis, 'fetch', async () => {
    calls++
    if (calls === 1) {
      await gate
      return new Response('synthetic weights')
    }
    return new Response('가\n나\n')
  })
  try {
    const controller = new OcrModelController(store)
    const first = controller.addBase()
    const retry = controller.addBase()
    assert.equal(calls, 1)
    release()
    const [a, b] = await Promise.allSettled([first, retry])
    assert.equal(a.status, 'rejected')
    assert.equal(b.status, 'rejected')
    assert.equal(calls, 1)
    assert.equal(store.models().length, 0)
    await assert.rejects(controller.addBase(), { code: 'UNAVAILABLE' })
    assert.equal(calls, 2)
  } finally {
    release()
    store.close()
  }
})

const weights = Buffer.from('synthetic weights')
const dictionary = Buffer.from('가\n나\n')
const bytes = [weights, dictionary]
const artifacts = BASE_MODEL_ARTIFACTS.map((artifact, index) => ({
  ...artifact,
  sha256: createHash('sha256').update(bytes[index]!).digest('hex')
}))

test('verified artifacts register atomically and an existing base is revalidated without downloading', async (t) => {
  const store = new OcrStore(':memory:', 1024 * 1024)
  t.after(() => store.close())
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    assert.equal(options.redirect, 'error')
    return new Response(bytes[calls++]!)
  })
  const first = await registerBaseModel(store, artifacts)
  assert.equal(first.duplicate, false)
  assert.equal(first.model.id, BASE_MODEL_ID)
  assert.equal((await registerBaseModel(store, artifacts)).duplicate, true)
  assert.equal(calls, 2)
  const before = store.model(BASE_MODEL_ID)
  await assert.rejects(registerBaseModel(store), { code: 'UNAVAILABLE' })
  assert.deepEqual(store.model(BASE_MODEL_ID), before)
  assert.equal(calls, 2)
})

test('a changed dictionary or oversized artifact leaves no partially registered base', async (t) => {
  const store = new OcrStore(':memory:', 1024 * 1024)
  t.after(() => store.close())
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => new Response(calls++ === 0 ? weights : '다\n라\n'))
  await assert.rejects(registerBaseModel(store, artifacts), { code: 'UNAVAILABLE' })
  assert.equal(calls, 2)
  assert.equal(store.models().length, 0)
  calls = 0
  await assert.rejects(
    registerBaseModel(
      store,
      artifacts.map((artifact) => ({ ...artifact, maximumBytes: 1 }))
    ),
    { code: 'UPLOAD_TOO_LARGE' }
  )
  assert.equal(store.models().length, 0)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { OcrModelController } from '../src/model-controller.js'
import { OcrStore } from '../src/store.js'

test('base model retries share the actual download until registration settles', async (context) => {
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
    const [a, b] = await Promise.all([first, retry])
    assert.equal(calls, 2)
    assert.deepEqual(a, b)
    assert.equal(store.models().length, 1)
    assert.equal((await controller.addBase()).duplicate, true)
    assert.equal(calls, 2)
  } finally {
    release()
    store.close()
  }
})

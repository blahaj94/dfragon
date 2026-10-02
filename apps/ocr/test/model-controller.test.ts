import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { OcrModelController } from '../src/model-controller.js'
import { OcrStore } from '../src/store.js'
import { BASE_MODEL_ARTIFACTS, BASE_MODEL_ID, registerBaseModel } from '../src/base-model.js'

test('기본 모델 동시 재시도는 다운로드를 공유하고 무결성 실패 뒤 저장 없이 다시 시도할 수 있다', async (context) => {
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
const artifacts = BASE_MODEL_ARTIFACTS.map((artifact, index) => {
  const testArtifact = { ...artifact }
  const sha256 = createHash('sha256').update(bytes[index]!).digest('hex')
  testArtifact.sha256 = sha256

  return testArtifact
})

test('검증된 기본 모델은 원자적으로 등록하고 기존 모델도 다운로드 없이 bytes를 다시 검증한다', async (t) => {
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

test('기본 모델 사전 변경·파일 한도 초과는 모델을 부분 등록하지 않는다', async (t) => {
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

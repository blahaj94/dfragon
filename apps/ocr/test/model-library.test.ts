import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { OcrStore } from '../src/store.js'
import { inspectModelFiles, parseModelUpload } from '../src/model-library.js'

const files = () =>
  new Map([
    ['weights.pdparams', Buffer.from('synthetic weights; never executed')],
    ['characters.txt', Buffer.from('가\n나\nA\n')]
  ])
const metadata = () =>
  parseModelUpload({
    id: randomUUID(),
    name: '검증 모델',
    preset: 'korean-ppocrv5',
    kind: 'pretrained',
    parentId: null
  })

test('model registration preserves bytes and parentage and retry cannot overwrite a model', () => {
  const store = new OcrStore(':memory:', 1024 * 1024)
  try {
    const base = metadata()
    const first = store.addModel(base, files())
    assert.equal(first.duplicate, false)
    assert.equal(store.addModel(base, files()).duplicate, true)
    assert.deepEqual(store.modelFile(base.id, 'weights.pdparams'), files().get('weights.pdparams'))
    assert.equal(store.model(base.id).files[0].sha256.length, 64)
    const changed = files().set('weights.pdparams', Buffer.from('changed'))
    assert.throws(() => store.addModel(base, changed), { code: 'MODEL_ID_CONFLICT' })
    const child = parseModelUpload({
      ...base,
      id: randomUUID(),
      kind: 'finetuned',
      parentId: base.id
    })
    store.addModel(child, changed)
    assert.throws(
      () =>
        store.addModel(
          { ...child, id: randomUUID() },
          files().set('characters.txt', Buffer.from('나\n가\nA\n'))
        ),
      { code: 'INVALID_INPUT' }
    )
    assert.equal(store.models().length, 2)
    assert.equal(store.model(child.id).parentId, base.id)
    assert.deepEqual(store.modelFile(base.id, 'weights.pdparams'), files().get('weights.pdparams'))
  } finally {
    store.close()
  }
})

test('missing parent, incomplete files and capacity failures leave no partially registered model', () => {
  const store = new OcrStore(':memory:', 10)
  const base = metadata()
  try {
    assert.throws(() => store.addModel(base, files()), { code: 'STORAGE_LIMIT' })
    assert.equal(store.models().length, 0)
    assert.throws(
      () => store.addModel({ ...base, kind: 'finetuned', parentId: randomUUID() }, files()),
      { code: 'NOT_FOUND' }
    )
    assert.throws(() => store.addModel(base, new Map([['weights.pdparams', Buffer.from('x')]])), {
      code: 'INVALID_INPUT'
    })
    assert.equal(store.models().length, 0)
  } finally {
    store.close()
  }
})

test('dictionary order is retained and duplicate, space, multi-character and extra files fail', () => {
  const dictionary = files().get('characters.txt')!
  inspectModelFiles(files())
  assert.equal(dictionary.toString(), '가\n나\nA\n')
  for (const value of ['가\n가\n', '가\n \n', '가나\n', '']) {
    assert.throws(() => inspectModelFiles(files().set('characters.txt', Buffer.from(value))))
  }
  assert.throws(() => inspectModelFiles(files().set('../secret', Buffer.from('x'))), {
    code: 'INVALID_INPUT'
  })
  assert.throws(() => inspectModelFiles(files().set('characters.txt', Buffer.from([0xff]))), {
    code: 'INVALID_INPUT'
  })
  assert.throws(() => inspectModelFiles(files().set('evaluation.json', Buffer.from('not json'))), {
    code: 'INVALID_INPUT'
  })
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash, randomUUID } from 'node:crypto'
import { OcrStore } from '../src/store.js'
import { inspectModelFiles, parseModelUpload, validateModelLineage } from '../src/model-library.js'

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

test('모델 부모 관계는 일반 미세 조정의 동일 bytes와 문자 확장의 순서 있는 접두부를 구분한다', () => {
  const input = { kind: 'finetuned', preset: 'korean-ppocrv5' } as const
  const parentDictionary = Buffer.from('가\n나\n')
  const lineage = {
    input,
    parentPreset: input.preset,
    parentDictionary,
    dictionary: parentDictionary
  }
  validateModelLineage(lineage)
  assert.throws(() => validateModelLineage({ ...lineage, parentPreset: 'other' }), {
    code: 'INVALID_INPUT'
  })
  assert.throws(
    () => validateModelLineage({ ...lineage, dictionary: Buffer.from('가\r\n나\r\n') }),
    { code: 'INVALID_INPUT' }
  )
  const expanded = { ...lineage, input: { ...input, kind: 'expanded' as const } }
  validateModelLineage({ ...expanded, dictionary: Buffer.from('가\r\n나\r\n★\r\n') })
  for (const dictionary of ['가\n나\n', '나\n가\n★\n', '가\n★\n', '가\n나\n★\n']) {
    const value = Buffer.from(dictionary)
    if (dictionary === '가\n나\n★\n') {
      validateModelLineage({ ...expanded, dictionary: value })
    } else {
      assert.throws(() => validateModelLineage({ ...expanded, dictionary: value }), {
        code: 'INVALID_INPUT'
      })
    }
  }
  assert.equal(parentDictionary.toString(), '가\n나\n')
})

test('모델 등록은 파일, 부모 관계를 보존하고 동일 ID 재시도로 덮어쓰지 않는다', () => {
  const store = new OcrStore(':memory:', 1024 * 1024)
  try {
    const base = metadata()
    const first = store.addModel(base, files())
    assert.equal(first.duplicate, false)
    assert.equal(store.addModel(base, files()).duplicate, true)
    assert.deepEqual(store.modelFile(base.id, 'weights.pdparams'), files().get('weights.pdparams'))
    assert.deepEqual(
      store.model(base.id).files,
      [...files()].map(([name, bytes]) => {
        const size = bytes.length
        const sha256 = createHash('sha256').update(bytes).digest('hex')

        return { name, bytes: size, sha256 }
      })
    )
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

test('부모 누락, 파일 누락, 저장 한도 실패는 모델을 부분 등록하지 않는다', () => {
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

test('모델 사전 순서를 보존하고 중복, 공백, 다중 문자, 추가 파일을 거절한다', () => {
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

test('문자 확장 모델은 부모 사전 전체 순서를 유지하고 새 문자만 뒤에 추가한다', () => {
  const store = new OcrStore(':memory:', 1024 * 1024)
  try {
    const base = metadata()
    store.addModel(base, files())
    const expanded = parseModelUpload({
      ...base,
      id: randomUUID(),
      kind: 'expanded',
      parentId: base.id
    })
    const extendedFiles = files().set('characters.txt', Buffer.from('가\n나\nA\n★\n龍\nあ\nア\n'))
    store.addModel(expanded, extendedFiles)
    assert.equal(store.model(expanded.id).kind, 'expanded')
    assert.deepEqual(store.modelFile(base.id, 'characters.txt'), files().get('characters.txt'))
    for (const dictionary of ['가\n나\nA\n', '나\n가\nA\n★\n', '가\nA\n★\n', '가\n나\nA\n가\n']) {
      assert.throws(
        () =>
          store.addModel(
            { ...expanded, id: randomUUID() },
            files().set('characters.txt', Buffer.from(dictionary))
          ),
        { code: 'INVALID_INPUT' }
      )
    }
    assert.throws(
      () => store.addModel({ ...expanded, id: randomUUID(), kind: 'finetuned' }, extendedFiles),
      { code: 'INVALID_INPUT' }
    )
    store.addModel(
      { ...expanded, id: randomUUID(), kind: 'finetuned', parentId: expanded.id },
      extendedFiles
    )
    assert.equal(store.models().length, 3)
    assert.throws(() => parseModelUpload({ ...expanded, parentId: null }))
  } finally {
    store.close()
  }
})

test('모델 ID와 파일 SHA-256은 별개이며 같은 bytes의 새 ID 등록과 파일 순서를 바꾼 재시도를 허용한다', () => {
  const store = new OcrStore(':memory:', 1024 * 1024)
  const base = metadata()
  const content = files().set('weights.pdparams', Buffer.from('abc'))
  try {
    const first = store.addModel(base, content).model
    // SHA-256의 공개된 abc 검증 벡터로 대상 함수의 출력과 독립적으로 확인한다.
    assert.deepEqual(
      first.files.find((file) => file.name === 'weights.pdparams'),
      {
        name: 'weights.pdparams',
        bytes: 3,
        sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
      }
    )
    const reversed = new Map([...content].reverse())
    assert.deepEqual(store.addModel(base, reversed), { model: first, duplicate: true })

    const second = store.addModel({ ...base, id: randomUUID() }, content).model
    assert.notEqual(first.id, second.id)
    assert.deepEqual(first.files, second.files)
    assert.equal(store.models().length, 2)
  } finally {
    store.close()
  }
})

test('동일 모델 ID의 메타데이터, 파일, 평가 요약 변경을 거절하고 기존 bytes, 해시, 등록 시각을 보존한다', () => {
  const store = new OcrStore(':memory:', 1024 * 1024)
  const base = metadata()
  const content = files().set('evaluation.json', Buffer.from('{"samples":12}'))
  try {
    const before = store.addModel(base, content).model
    const changes = [
      { title: '이름 변경', metadata: { ...base, name: '변경 모델' }, content },
      {
        title: '가중치 변경',
        metadata: base,
        content: new Map(content).set('weights.pdparams', Buffer.from('다른 가중치'))
      },
      {
        title: '사전 순서 변경',
        metadata: base,
        content: new Map(content).set('characters.txt', Buffer.from('나\n가\nA\n'))
      },
      {
        title: '평가 값 변경',
        metadata: base,
        content: new Map(content).set('evaluation.json', Buffer.from('{"samples":13}'))
      },
      { title: '평가 파일 제거', metadata: base, content: files() }
    ]
    for (const change of changes) {
      assert.throws(
        () => store.addModel(change.metadata, change.content),
        { code: 'MODEL_ID_CONFLICT' },
        change.title
      )
      assert.deepEqual(store.models(), [before], change.title)
      for (const [name, bytes] of content) {
        assert.deepEqual(store.modelFile(base.id, name), bytes, change.title)
      }
    }
  } finally {
    store.close()
  }
})

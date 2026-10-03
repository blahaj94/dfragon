import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { OcrStore } from '../src/store.js'
import { parseUpload } from '../src/images.js'
import { parseSyntheticUpload } from '../src/synthetic-upload.js'
import { parseModelUpload } from '../src/model-library.js'
import { upload, syntheticUpload } from './fixtures.js'

async function diskStore(t: TestContext, maximumBytes: number) {
  const directory = await mkdtemp(join(tmpdir(), 'ocr-atomicity-'))
  const path = join(directory, 'data.sqlite')
  const store = new OcrStore(path, maximumBytes)
  const database = new DatabaseSync(path)
  t.after(async () => {
    database.close()
    store.close()
    await rm(directory, { recursive: true, force: true })
  })

  return { store, database }
}

// 실제 SQLite가 중간 쓰기를 거절하도록 임시 DB에만 trigger를 설치한다.
// HTTP 입력 검증이나 저장 판단을 mock하지 않고 transaction rollback을 검증한다.
test('두 번째 표본 쓰기가 실패하면 캡처·첫 표본·사용 bytes를 되돌리고 같은 요청을 다시 저장할 수 있다', async (t) => {
  const existing = parseUpload(upload())
  const incoming = parseUpload(upload())
  const { store, database } = await diskStore(t, existing.png.length + incoming.png.length)
  store.add(existing.capture, existing.png)
  store.updateSample(`${existing.capture.id}-1`, { text: '기존자료' })
  const before = store.exportManifest()
  database.exec(`CREATE TRIGGER fail_sample BEFORE INSERT ON samples
    WHEN EXISTS(SELECT 1 FROM samples WHERE capture_id=NEW.capture_id)
    BEGIN SELECT RAISE(ABORT, '격리 표본 쓰기 실패'); END`)

  assert.throws(() => store.add(incoming.capture, incoming.png), /격리 표본 쓰기 실패/)
  const after = store.exportManifest()
  assert.deepEqual(after.captures, before.captures)
  assert.deepEqual(after.samples, before.samples)
  assert.equal(store.stats()?.storedBytes, existing.png.length)
  assert.throws(() => store.capture(incoming.capture.id), { code: 'NOT_FOUND' })
  assert.throws(() => store.sample(`${incoming.capture.id}-1`), { code: 'NOT_FOUND' })
  assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), [])

  database.exec('DROP TRIGGER fail_sample')
  assert.deepEqual(store.add(incoming.capture, incoming.png), {
    id: incoming.capture.id,
    duplicate: false
  })
  assert.deepEqual(store.add(incoming.capture, incoming.png), {
    id: incoming.capture.id,
    duplicate: true
  })
  assert.equal(store.stats()?.captures, 2)
  assert.equal(store.stats()?.samples, 4)
  assert.equal(store.stats()?.storedBytes, existing.png.length + incoming.png.length)
})

test('합성 표본 쓰기가 실패하면 원본·정답·train 배정을 모두 되돌린다', async (t) => {
  const incoming = parseSyntheticUpload(syntheticUpload())
  const { store, database } = await diskStore(t, incoming.png.length)
  database.exec(`CREATE TRIGGER fail_synthetic BEFORE INSERT ON samples
    BEGIN SELECT RAISE(ABORT, '격리 합성 쓰기 실패'); END`)

  assert.throws(() => store.add(incoming.capture, incoming.png), /격리 합성 쓰기 실패/)
  assert.equal(store.stats()?.captures, 0)
  assert.equal(store.stats()?.samples, 0)
  assert.equal(store.stats()?.storedBytes, 0)
  assert.deepEqual(database.prepare('SELECT * FROM label_splits').all(), [])
  assert.deepEqual(database.prepare('SELECT * FROM label_unassigned').all(), [])

  database.exec('DROP TRIGGER fail_synthetic')
  store.add(incoming.capture, incoming.png)
  assert.equal(store.sample(`${incoming.capture.id}-1`).text, '합성고래')
  assert.equal(store.sample(`${incoming.capture.id}-1`).split, 'train')
})

test('두 번째 모델 파일 쓰기가 실패하면 메타데이터·첫 파일을 되돌리고 부모와 저장 한도를 보존한다', async (t) => {
  const files = new Map([
    ['weights.pdparams', Buffer.from('abc')],
    ['characters.txt', Buffer.from('가\n나\n')]
  ])
  const fileBytes = 3 + Buffer.byteLength('가\n나\n')
  const { store, database } = await diskStore(t, fileBytes * 2)
  const parent = parseModelUpload({
    id: randomUUID(),
    name: '부모 모델',
    preset: 'korean-ppocrv5',
    kind: 'pretrained',
    parentId: null
  })
  const before = store.addModel(parent, files).model
  const child = parseModelUpload({
    ...parent,
    id: randomUUID(),
    name: '자식 모델',
    kind: 'finetuned',
    parentId: parent.id
  })
  database.exec(`CREATE TRIGGER fail_model_file BEFORE INSERT ON model_files
    WHEN EXISTS(SELECT 1 FROM model_files WHERE model_id=NEW.model_id)
    BEGIN SELECT RAISE(ABORT, '격리 모델 쓰기 실패'); END`)

  assert.throws(() => store.addModel(child, files), /격리 모델 쓰기 실패/)
  assert.deepEqual(store.models(), [before])
  assert.deepEqual(store.modelFile(parent.id, 'weights.pdparams'), Buffer.from('abc'))
  assert.throws(() => store.model(child.id), { code: 'NOT_FOUND' })
  assert.throws(() => store.modelFile(child.id, 'weights.pdparams'), { code: 'NOT_FOUND' })
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM model_files').get()?.count, 2)
  assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), [])

  database.exec('DROP TRIGGER fail_model_file')
  assert.equal(store.addModel(child, files).duplicate, false)
  assert.equal(store.addModel(child, files).duplicate, true)
  assert.equal(
    database.prepare('SELECT SUM(length(data)) AS bytes FROM model_files').get()?.bytes,
    fileBytes * 2
  )
})

test('원본과 모델 파일 합산 저장 한도는 정확한 경계를 받고 가득 찬 뒤 동일 재시도와 기존 bytes를 보존한다', () => {
  const original = parseUpload(upload())
  const modelFiles = new Map([
    ['weights.pdparams', Buffer.from('abc')],
    ['characters.txt', Buffer.from('가\n')]
  ])
  const metadata = parseModelUpload({
    id: randomUUID(),
    name: '합산 한도 모델',
    preset: 'korean-ppocrv5',
    kind: 'pretrained',
    parentId: null
  })
  const store = new OcrStore(':memory:', original.png.length + 3 + Buffer.byteLength('가\n'))
  try {
    store.add(original.capture, original.png)
    store.addModel(metadata, modelFiles)
    assert.equal(store.add(original.capture, original.png).duplicate, true)
    assert.equal(store.addModel(metadata, modelFiles).duplicate, true)

    const extra = parseUpload(upload())
    assert.throws(() => store.add(extra.capture, extra.png), { code: 'STORAGE_LIMIT' })
    assert.throws(() => store.addModel({ ...metadata, id: randomUUID() }, modelFiles), {
      code: 'STORAGE_LIMIT'
    })
    assert.equal(store.stats()?.captures, 1)
    assert.equal(store.models().length, 1)
    assert.deepEqual(store.capture(original.capture.id).png, original.png)
    assert.deepEqual(store.modelFile(metadata.id, 'weights.pdparams'), Buffer.from('abc'))
  } finally {
    store.close()
  }
})

test('원본·모델 중 어떤 것을 먼저 저장해도 합산 한도 1 byte 초과를 부분 저장 없이 거절한다', () => {
  const original = parseUpload(upload())
  const content = new Map([
    ['weights.pdparams', Buffer.from('abc')],
    ['characters.txt', Buffer.from('가\n')]
  ])
  const metadata = parseModelUpload({
    id: randomUUID(),
    name: '저장 순서 검증',
    preset: 'korean-ppocrv5',
    kind: 'pretrained',
    parentId: null
  })
  const maximumBytes = original.png.length + 3 + Buffer.byteLength('가\n') - 1
  for (const originalFirst of [false, true]) {
    const store = new OcrStore(':memory:', maximumBytes)
    try {
      if (originalFirst) {
        store.add(original.capture, original.png)
        assert.throws(() => store.addModel(metadata, content), { code: 'STORAGE_LIMIT' })
        assert.equal(store.stats()?.captures, 1)
        assert.equal(store.models().length, 0)
        assert.throws(() => store.modelFile(metadata.id, 'weights.pdparams'), { code: 'NOT_FOUND' })
      } else {
        store.addModel(metadata, content)
        assert.throws(() => store.add(original.capture, original.png), { code: 'STORAGE_LIMIT' })
        assert.equal(store.stats()?.captures, 0)
        assert.equal(store.stats()?.samples, 0)
        assert.equal(store.models().length, 1)
      }
    } finally {
      store.close()
    }
  }
})

test('정답 UPDATE가 실패하면 부분 필드와 자동 추가 train 배정을 같은 transaction에서 되돌린다', async (t) => {
  const image = parseUpload(upload())
  const { store, database } = await diskStore(t, 1024 * 1024)
  store.add(image.capture, image.png)
  const id = `${image.capture.id}-1`
  store.updateSample(id, { text: '기존정답' })
  const options = { ratios: { train: 100, val: 0, test: 0 }, replaceExisting: false }
  store.applySplit(options, store.previewSplit(options).fingerprint)
  const before = store.sample(id)
  const fingerprint = store.previewSplit(options).fingerprint
  database.exec(`CREATE TRIGGER fail_label_update BEFORE UPDATE ON samples
    WHEN NEW.text='새정답' BEGIN SELECT RAISE(ABORT, '격리 정답 쓰기 실패'); END`)

  assert.throws(() => store.updateSample(id, { text: '새정답' }), /격리 정답 쓰기 실패/)
  assert.deepEqual(store.sample(id), before)
  assert.equal(database.prepare('SELECT 1 FROM label_splits WHERE text=?').get('새정답'), undefined)
  assert.equal(store.previewSplit(options).fingerprint, fingerprint)
  assert.equal(store.splitStats().initialized, true)

  database.exec('DROP TRIGGER fail_label_update')
  const updated = store.updateSample(id, { text: '새정답' })
  assert.equal(updated.text, '새정답')
  assert.equal(updated.excluded, false)
  assert.equal(updated.split, 'train')
})

test('두 번째 닉네임 분할 쓰기가 실패하면 모든 배정과 자동 추가 활성화를 되돌리고 같은 미리보기로 재시도한다', async (t) => {
  const { store, database } = await diskStore(t, 1024 * 1024)
  const ids: string[] = []
  for (const text of ['가', '나', '다']) {
    const image = parseUpload(upload())
    store.add(image.capture, image.png)
    const id = `${image.capture.id}-1`
    store.updateSample(id, { text })
    ids.push(id)
  }
  const options = { ratios: { train: 100, val: 0, test: 0 }, replaceExisting: false }
  const preview = store.previewSplit(options)
  const before = ids.map((id) => store.sample(id))
  database.exec(`CREATE TRIGGER fail_split BEFORE INSERT ON label_splits
    WHEN EXISTS(SELECT 1 FROM label_splits)
    BEGIN SELECT RAISE(ABORT, '격리 분할 쓰기 실패'); END`)

  assert.throws(() => store.applySplit(options, preview.fingerprint), /격리 분할 쓰기 실패/)
  assert.deepEqual(
    ids.map((id) => store.sample(id)),
    before
  )
  assert.deepEqual(database.prepare('SELECT * FROM label_splits').all(), [])
  assert.deepEqual(database.prepare('SELECT * FROM settings').all(), [])
  assert.equal(store.splitStats().initialized, false)
  assert.equal(store.previewSplit(options).fingerprint, preview.fingerprint)

  database.exec('DROP TRIGGER fail_split')
  store.applySplit(options, preview.fingerprint)
  assert.equal(store.splitStats().initialized, true)
  assert.deepEqual(
    ids.map((id) => store.sample(id).split),
    ['train', 'train', 'train']
  )
})

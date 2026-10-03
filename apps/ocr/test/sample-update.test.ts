import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { planSampleSplit } from '../src/sample-update.js'
import { OcrStore } from '../src/store.js'
import { parseUpload } from '../src/images.js'
import { parseSyntheticUpload } from '../src/synthetic-upload.js'
import { syntheticUpload, upload } from './fixtures.js'

const input: Parameters<typeof planSampleSplit>[0] = {
  previousSample: { text: null, split: 'unassigned' },
  text: '새이름',
  excluded: false,
  targetSplit: undefined,
  knownLabel: false,
  automaticSplitInitialized: true,
  confirmSplitChange: false
}

test('표본 분할 판단은 기존 배정·수동 미배정·제외·미작성 계약을 따른다', () => {
  assert.deepEqual(planSampleSplit(input), { nextSplit: 'train', assignNew: true })
  assert.deepEqual(planSampleSplit({ ...input, targetSplit: 'val' }), {
    nextSplit: 'val',
    assignNew: false
  })
  for (const change of [
    { knownLabel: true },
    { excluded: true },
    { text: null },
    { automaticSplitInitialized: false }
  ]) {
    assert.deepEqual(planSampleSplit({ ...input, ...change }), {
      nextSplit: 'unassigned',
      assignNew: false
    })
  }
  const assigned = { ...input, previousSample: { text: '기존', split: 'test' as const } }
  assert.throws(() => planSampleSplit(assigned), { code: 'LABEL_SPLIT_CHANGE' })
  assert.equal(planSampleSplit({ ...assigned, confirmSplitChange: true }).nextSplit, 'train')
  assert.equal(planSampleSplit({ ...assigned, targetSplit: 'test' }).nextSplit, 'test')
  assert.equal(planSampleSplit({ ...assigned, text: '기존' }).nextSplit, 'train')
})

test('분할 이동을 확인하지 않으면 정답·제외·새 train 배정을 함께 거절한다', () => {
  const store = new OcrStore(':memory:', 1024 * 1024)
  try {
    const image = parseUpload(upload())
    store.add(image.capture, image.png)
    const id = `${image.capture.id}-1`
    store.updateSample(id, { text: '기존', excluded: false, confirmSplitChange: false })
    store.assign('기존', 'test')
    const options = { ratios: { train: 60, val: 20, test: 20 }, replaceExisting: false }
    const preview = store.previewSplit(options)
    store.applySplit(options, preview.fingerprint)
    const before = store.exportManifest()
    const fingerprint = store.previewSplit(options).fingerprint

    assert.throws(
      () => store.updateSample(id, { text: '새이름', excluded: true, confirmSplitChange: false }),
      { code: 'LABEL_SPLIT_CHANGE' }
    )
    const after = store.exportManifest()
    assert.deepEqual(after.captures, before.captures)
    assert.deepEqual(after.samples, before.samples)
    assert.equal(store.previewSplit(options).fingerprint, fingerprint)
    assert.throws(
      () => store.updateSample(id, { text: '새이름', excluded: false, confirmSplitChange: false }),
      { code: 'LABEL_SPLIT_CHANGE' }
    )
    assert.equal(store.previewSplit(options).fingerprint, fingerprint)
    assert.equal(
      store.updateSample(id, { text: '새이름', excluded: false, confirmSplitChange: true }).split,
      'train'
    )
  } finally {
    store.close()
  }
})

test('합성 표본의 제외·복원만 갱신해도 고정 정답과 train 배정을 보존한다', () => {
  const store = new OcrStore(':memory:', 1024 * 1024)
  try {
    const image = parseSyntheticUpload(syntheticUpload())
    store.add(image.capture, image.png)
    const id = `${image.capture.id}-1`
    const excluded = store.updateSample(id, { excluded: true })
    assert.equal(excluded.text, image.capture.synthetic.text)
    assert.equal(excluded.split, 'train')
    assert.equal(excluded.excluded, true)
    assert.equal(store.updateSample(id, { excluded: false }).excluded, false)
    assert.throws(() => store.updateSample(id, { text: null }), {
      code: 'SYNTHETIC_LABEL_IMMUTABLE'
    })
    assert.equal(store.sample(id).text, image.capture.synthetic.text)
    assert.equal(store.sample(id).split, 'train')
  } finally {
    store.close()
  }
})

test('서로 다른 SQLite 연결에서 정답과 제외를 부분 갱신하면 최신 보완 필드와 NFC 닉네임을 보존한다', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'ocr-partial-update-'))
  const path = join(directory, 'data.sqlite')
  const first = new OcrStore(path, 1024 * 1024)
  const second = new OcrStore(path, 1024 * 1024)
  t.after(async () => {
    second.close()
    first.close()
    await rm(directory, { recursive: true, force: true })
  })
  const image = parseUpload(upload())
  first.add(image.capture, image.png)
  const id = `${image.capture.id}-1`
  first.updateSample(id, { text: '이전정답', excluded: false })

  first.updateSample(id, { excluded: true })
  const corrected = second.updateSample(id, { text: '가' })
  assert.equal(corrected.text, '가')
  assert.equal(corrected.excluded, true)
  assert.equal(corrected.split, 'unassigned')

  second.assign('가', 'val')
  const restored = first.updateSample(id, { excluded: false })
  assert.equal(restored.text, '가')
  assert.equal(restored.excluded, false)
  assert.equal(restored.split, 'val')

  assert.throws(() => second.updateSample(id, { text: null }), { code: 'LABEL_SPLIT_CHANGE' })
  assert.deepEqual(first.sample(id), restored)
  const pending = second.updateSample(id, { text: null, confirmSplitChange: true })
  assert.equal(pending.text, null)
  assert.equal(pending.excluded, false)
  assert.equal(pending.split, 'unassigned')
  assert.deepEqual(first.sample(id), pending)
})

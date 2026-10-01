import assert from 'node:assert/strict'
import test from 'node:test'
import { planSampleSplit } from '../src/sample-update.js'
import { OcrStore } from '../src/store.js'
import { parseUpload } from '../src/images.js'
import { upload } from './fixtures.js'

const input: Parameters<typeof planSampleSplit>[0] = {
  previousSample: { text: null, split: 'unassigned' },
  text: '새이름',
  excluded: false,
  targetSplit: undefined,
  knownLabel: false,
  automaticSplitInitialized: true,
  confirmSplitChange: false
}

test('sample split planning is DB-free and preserves existing, manual, excluded and pending assignments', () => {
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

test('declined sample split change writes neither the label, exclusion nor a new train assignment', () => {
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
    assert.deepEqual(store.exportManifest(), before)
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

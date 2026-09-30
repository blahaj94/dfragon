import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { PNG } from 'pngjs'
import { parseUpload } from '../src/images.js'
import { parseSyntheticUpload } from '../src/synthetic-upload.js'
import { OcrStore } from '../src/store.js'
import { syntheticUpload, upload } from './fixtures.js'

test('synthetic input requires an opaque PNG, a label and bounded rendering metadata', () => {
  const input = syntheticUpload()
  const transparent = new PNG({ width: 2, height: 2 })
  for (const invalid of [
    { ...input, generatedAt: 'invalid' },
    { ...input, id: '../image' },
    { ...input, text: null },
    { ...input, text: '' },
    { ...input, text: '공 백' },
    { ...input, png: 'bad png' },
    { ...input, png: PNG.sync.write(transparent).toString('base64') },
    { ...input, split: 'test' },
    { ...input, rendering: { ...input.rendering, scale: 17 } },
    { ...input, rendering: { ...input.rendering, foregroundRgb: [256, 0, 0] } },
    { ...input, rendering: { ...input.rendering, profile: 'unknown' } },
    { ...input, rendering: { ...input.rendering, localPath: '/synthetic/private' } }
  ]) {
    assert.throws(() => parseSyntheticUpload(invalid), { code: 'INVALID_INPUT' })
  }
  const parsed = parseSyntheticUpload({ ...input, text: '합성' })
  assert.equal(parsed.capture.synthetic?.text, '합성')
  assert.deepEqual(parsed.capture.crops, [{ slot: 1, x: 0, y: 0, width: 8, height: 4 }])
  assert.throws(() => parseUpload({ ...upload(), kind: 'synthetic' }), { code: 'INVALID_INPUT' })
})

test('synthetic bytes, label and train assignment are atomic and idempotent', () => {
  const input = syntheticUpload()
  const { capture, png } = parseSyntheticUpload(input)
  const store = new OcrStore(':memory:', png.length)
  try {
    assert.equal(store.add(capture, png).duplicate, false)
    const sample = store.sample(`${input.id}-1`)
    assert.equal(sample.text, input.text)
    assert.equal(sample.kind, 'synthetic')
    assert.equal(sample.split, 'train')
    assert.equal(store.stats()?.pending, 0)
    assert.deepEqual(store.capture(input.id).png, png)
    assert.deepEqual(store.exportManifest().captures[0].synthetic, capture.synthetic)
    store.updateSample(sample.id, { text: input.text, excluded: true, confirmSplitChange: false })
    assert.equal(store.add(capture, png).duplicate, true)
    assert.equal(store.sample(sample.id).excluded, true)
    const changed = parseSyntheticUpload({ ...input, text: '다른고래' })
    assert.throws(() => store.add(changed.capture, changed.png), { code: 'CAPTURE_ID_CONFLICT' })
    const another = parseSyntheticUpload(syntheticUpload(randomUUID(), '새고래'))
    assert.throws(() => store.add(another.capture, another.png), { code: 'STORAGE_LIMIT' })
    assert.equal(store.stats()?.captures, 1)
    assert.throws(() => store.assign('새고래', 'train'), { code: 'NOT_FOUND' })
  } finally {
    store.close()
  }
})

test('synthetic nicknames cannot leak into evaluation through upload, edits or repartition', () => {
  const store = new OcrStore(':memory:', 1024 * 1024)
  try {
    const real = parseUpload(upload())
    store.add(real.capture, real.png)
    const realId = `${real.capture.id}-1`
    store.updateSample(realId, { text: '실제고래', excluded: false, confirmSplitChange: false })
    for (const split of ['unassigned', 'val', 'test'] as const) {
      store.assign('실제고래', split)
      const blocked = parseSyntheticUpload(syntheticUpload(randomUUID(), '실제고래'))
      assert.throws(() => store.add(blocked.capture, blocked.png), { code: 'SYNTHETIC_TRAIN_ONLY' })
      assert.equal(store.stats()?.captures, 1)
    }
    store.assign('실제고래', 'train')
    const generated = parseSyntheticUpload(syntheticUpload(randomUUID(), '실제고래'))
    store.add(generated.capture, generated.png)
    const syntheticId = `${generated.capture.id}-1`
    for (const split of ['unassigned', 'val', 'test'] as const) {
      assert.throws(() => store.assign('실제고래', split), { code: 'SYNTHETIC_TRAIN_ONLY' })
    }
    assert.throws(
      () =>
        store.updateSample(syntheticId, {
          text: '변경고래',
          excluded: false,
          confirmSplitChange: true
        }),
      { code: 'SYNTHETIC_LABEL_IMMUTABLE' }
    )
    const options = { ratios: { train: 0, val: 50, test: 50 }, replaceExisting: true }
    const preview = store.previewSplit(options)
    store.applySplit(options, preview.fingerprint)
    assert.equal(store.sample(realId).split, 'train')
    assert.equal(store.sample(syntheticId).split, 'train')
    assert.equal(store.splitStats().total.images, 1)
    assert.equal(store.list({ offset: 0, kind: 'synthetic' }).samples.length, 1)
    const stale = store.previewSplit(options)
    const another = parseSyntheticUpload(syntheticUpload(randomUUID(), '실제고래'))
    store.add(another.capture, another.png)
    assert.throws(() => store.applySplit(options, stale.fingerprint), {
      code: 'SPLIT_PREVIEW_STALE'
    })
    const beforeExclusion = store.previewSplit(options)
    store.updateSample(syntheticId, { text: '실제고래', excluded: true, confirmSplitChange: false })
    assert.throws(() => store.applySplit(options, beforeExclusion.fingerprint), {
      code: 'SPLIT_PREVIEW_STALE'
    })
  } finally {
    store.close()
  }
})

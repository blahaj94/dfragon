import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { PNG } from 'pngjs'
import { parseUpload } from '../src/images.js'
import { parseSyntheticUpload } from '../src/synthetic-upload.js'
import { OcrStore } from '../src/store.js'
import { syntheticUpload, upload } from './fixtures.js'

test('합성 입력은 불투명 PNG와 정답 및 범위 안의 렌더링 정보를 요구한다', () => {
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

test('합성 이미지, 정답, train 배정은 원자적으로 저장하고 같은 재요청을 중복 저장하지 않는다', () => {
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

test('합성 닉네임은 업로드, 수정, 재배정으로 평가 분할에 들어가지 못한다', () => {
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

test('렌더러 버전은 숫자 세 구간만 허용하고 마지막 줄바꿈을 저장하지 않는다', async (t) => {
  const input = syntheticUpload()
  for (const [name, rendererVersion] of [
    ['LF 꼬리', '0.1.2\n'],
    ['CR 꼬리', '0.1.2\r'],
    ['줄 구분자 꼬리', '0.1.2\u2028'],
    ['문단 구분자 꼬리', '0.1.2\u2029'],
    ['네 구간', '0.1.2.3'],
    ['접미사', '0.1.2-alpha']
  ] as const) {
    await t.test(name, () => {
      assert.throws(
        () =>
          parseSyntheticUpload({ ...input, rendering: { ...input.rendering, rendererVersion } }),
        { code: 'INVALID_INPUT' }
      )
    })
  }
  const parsed = parseSyntheticUpload({
    ...input,
    rendering: {
      ...input.rendering,
      rendererVersion: '12.34.56',
      scale: 16,
      foregroundRgb: [0, 0, 0],
      backgroundRgb: [255, 255, 255]
    }
  })
  assert.deepEqual(parsed.capture.synthetic.rendering, {
    rendererVersion: '12.34.56',
    profile: 'dotum',
    scale: 16,
    foregroundRgb: [0, 0, 0],
    backgroundRgb: [255, 255, 255]
  })
})

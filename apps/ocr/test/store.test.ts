import assert from 'node:assert/strict'
import test from 'node:test'
import { PNG } from 'pngjs'
import { createRequire } from 'node:module'
import { raidUpload, upload } from './fixtures.js'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OcrStore } from '../src/store.js'
import { parseUpload, cropPng, decodePng } from '../src/images.js'
import { parseLabel } from '../src/input.js'
test('one original per capture; retry is idempotent; crop pixels and metadata survive reopening', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ocr-store-'))
  let store = new OcrStore(join(directory, 'data.sqlite'), 1024 * 1024)
  try {
    const { capture, png } = parseUpload(upload())
    assert.equal(store.add(capture, png).duplicate, false)
    assert.equal(store.add(capture, png).duplicate, true)
    assert.throws(() => store.add({ ...capture, kind: 'participants' }, png), {
      code: 'CAPTURE_ID_CONFLICT'
    })
    assert.equal(store.stats()?.storedBytes, png.length)
    assert.equal(store.list({ offset: 0 }).samples.length, 2)
    const cropped = decodePng(cropPng(decodePng(png), capture.crops[0]))
    assert.deepEqual(
      [...cropped.data.subarray(0, 12)],
      [...decodePng(png).data.subarray((8 + 1) * 4, (8 + 4) * 4)]
    )
    store.close()
    store = new OcrStore(join(directory, 'data.sqlite'), 1024 * 1024)
    assert.deepEqual(store.capture(capture.id).png, png)
    assert.equal(store.sample(`${capture.id}-1`).uiScale, 0.75)
  } finally {
    store.close()
    await rm(directory, { recursive: true, force: true })
  }
})
test('nickname split applies across captures; label corrections need acknowledgement when leaving a split', () => {
  const store = new OcrStore(':memory:', 1024 * 1024)
  try {
    const first = parseUpload(upload()),
      second = parseUpload(upload())
    store.add(first.capture, first.png)
    store.add(second.capture, second.png)
    const a = `${first.capture.id}-1`,
      b = `${second.capture.id}-1`
    store.updateSample(a, {
      text: parseLabel('테스트닉네임'),
      excluded: false,
      confirmSplitChange: false
    })
    store.assign('테스트닉네임', 'train')
    assert.equal(
      store.updateSample(b, {
        text: parseLabel('테스트닉네임'),
        excluded: false,
        confirmSplitChange: false
      }).split,
      'train'
    )
    assert.equal(store.assign('테스트닉네임', 'test').affected, 2)
    assert.equal(store.sample(a).split, 'test')
    assert.throws(
      () =>
        store.updateSample(a, { text: '다른닉네임', excluded: false, confirmSplitChange: false }),
      { code: 'LABEL_SPLIT_CHANGE' }
    )
    assert.equal(
      store.updateSample(a, { text: '다른닉네임', excluded: false, confirmSplitChange: true })
        .split,
      'unassigned'
    )
    store.updateSample(a, { text: '다른닉네임', excluded: true, confirmSplitChange: false })
    assert.equal(store.list({ offset: 0, state: 'excluded' }).samples.length, 1)
    assert.equal(store.list({ offset: 0, split: 'test' }).samples.length, 1)
    assert.equal(store.exportManifest().captures.length, 2)
  } finally {
    store.close()
  }
})
test('invalid images, oversized geometry and quota failure leave no partial capture', () => {
  const body = upload()
  for (const change of [
    { originalPng: 'invalid' },
    { crops: [{ slot: 1, x: 7, y: 0, width: 2, height: 1 }] },
    { uiScale: null },
    { uiScale: 0 },
    { crops: [body.crops[0], body.crops[0]] }
  ]) {
    assert.throws(() => parseUpload({ ...body, ...change }))
  }
  const { capture, png } = parseUpload(body),
    store = new OcrStore(':memory:', png.length - 1)
  try {
    assert.throws(() => store.add(capture, png), { code: 'STORAGE_LIMIT' })
    assert.equal(store.stats()?.captures, 0)
    assert.equal(store.stats()?.samples, 0)
  } finally {
    store.close()
  }
})

test('duplicate IHDR, interlaced PNG and non-string UI scale source are rejected', () => {
  const body = upload(),
    png = Buffer.from(body.originalPng, 'base64')
  const repeated = Buffer.concat([png.subarray(0, 33), png.subarray(8)])
  assert.throws(() => decodePng(repeated))
  const interlaced = PNG.sync.write(new PNG({ width: 1, height: 1 }))
  interlaced[28] = 1
  const crc = createRequire(import.meta.url)('pngjs/lib/crc') as {
    crc32: (bytes: Buffer) => number
  }
  interlaced.writeInt32BE(crc.crc32(interlaced.subarray(12, 29)), 29)
  assert.equal(PNG.sync.read(interlaced).width, 1)
  assert.throws(() => decodePng(interlaced))
  assert.throws(() => parseUpload({ ...body, uiScaleSource: ['game'] }))
})

test('raid accepts twelve or selected rows while HUD and participant uploads keep four-slot limits', () => {
  const raid = raidUpload()
  const { capture } = parseUpload({ ...raid, crops: raid.crops.toReversed() })
  assert.equal(capture.kind, 'raid')
  assert.deepEqual(
    capture.crops.map(({ slot }) => slot),
    Array.from({ length: 12 }, (_, i) => i + 1)
  )
  const selected = parseUpload({ ...raid, crops: [raid.crops[1], raid.crops[9], raid.crops[11]] })
  assert.deepEqual(
    selected.capture.crops.map(({ slot }) => slot),
    [2, 10, 12]
  )

  for (const invalid of [
    { ...raid, crops: [] },
    { ...raid, crops: [...raid.crops, { ...raid.crops[0], slot: 13 }] },
    { ...raid, crops: [{ ...raid.crops[0], slot: 13 }] },
    { ...raid, crops: [raid.crops[9], raid.crops[9]] },
    { ...raid, kind: '__proto__' }
  ]) {
    assert.throws(() => parseUpload(invalid), { code: 'INVALID_INPUT' })
  }
  for (const kind of ['hud', 'participants']) {
    assert.equal(
      parseUpload({ ...raid, kind, crops: raid.crops.slice(0, 4) }).capture.crops.length,
      4
    )
    for (const crops of [raid.crops.slice(0, 5), [raid.crops[4]], [raid.crops[11]]]) {
      assert.throws(() => parseUpload({ ...raid, kind, crops }), { code: 'INVALID_INPUT' })
    }
  }
})

test('raid rows retain numeric order, labels and nickname splits alongside existing HUD samples', () => {
  const store = new OcrStore(':memory:', 1024 * 1024)
  try {
    const raid = parseUpload(raidUpload())
    const hud = parseUpload(upload())
    store.add(raid.capture, raid.png)
    store.add(hud.capture, hud.png)
    assert.equal(store.add(raid.capture, raid.png).duplicate, true)
    assert.equal(store.stats()?.captures, 2)
    assert.equal(store.stats()?.samples, 14)
    assert.equal(store.stats()?.storedBytes, raid.png.length + hud.png.length)
    assert.deepEqual(
      store.list({ offset: 0, kind: 'raid' }).samples.map(({ slot }) => slot),
      Array.from({ length: 12 }, (_, i) => i + 1)
    )
    for (const id of [`${raid.capture.id}-10`, `${raid.capture.id}-12`, `${hud.capture.id}-1`]) {
      store.updateSample(id, { text: '공대샘플', excluded: false, confirmSplitChange: false })
    }
    assert.equal(store.assign('공대샘플', 'test').affected, 3)
    store.updateSample(`${raid.capture.id}-11`, {
      text: null,
      excluded: true,
      confirmSplitChange: false
    })
    assert.equal(store.list({ offset: 0, kind: 'raid', split: 'test' }).samples.length, 2)
    assert.equal(store.list({ offset: 0, kind: 'raid', state: 'excluded' }).samples[0].slot, 11)
    const manifest = store.exportManifest()
    assert.equal(manifest.captures[0].kind, 'raid')
    assert.equal(manifest.captures[0].crops.length, 12)
    assert.equal(manifest.samples.find(({ id }) => id === `${raid.capture.id}-12`)?.split, 'test')
    assert.equal(manifest.samples.find(({ id }) => id === `${hud.capture.id}-1`)?.split, 'test')
    const last = store.sample(`${raid.capture.id}-12`)
    const cropped = decodePng(cropPng(decodePng(raid.png), last))
    const offset = (last.y * raid.capture.width + last.x) * 4
    assert.deepEqual(cropped.data, decodePng(raid.png).data.subarray(offset, offset + 4))
    assert(!('party' in last))
    assert(!('equipmentScoreText' in last))
  } finally {
    store.close()
  }
})

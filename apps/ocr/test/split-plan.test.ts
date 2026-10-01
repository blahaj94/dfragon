import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  characterGroup,
  planSplits,
  parseSplitOptions,
  splitStatistics,
  type SplitRow
} from '../src/split-plan.js'
import { OcrStore } from '../src/store.js'
import { parseUpload } from '../src/images.js'
import { upload } from './fixtures.js'

const options = { ratios: { train: 60, val: 20, test: 20 }, replaceExisting: false }
const sample = (text: string, id = text): SplitRow => ({
  id,
  text,
  excluded: false,
  split: 'unassigned'
})

test('counts character occurrences including Latin, numbers and other scripts, not image membership', () => {
  assert.deepEqual([...'ⓐ⒜Ⅰⅰ'].map(characterGroup), ['special', 'special', 'latin', 'latin'])
  const stats = splitStatistics([
    sample('검사★龍'),
    sample('あアA2Ω'),
    { ...sample('제외'), excluded: true }
  ])
  assert.deepEqual(stats.total.groups, {
    hangul: 2,
    special: 1,
    hanja: 1,
    hiragana: 1,
    katakana: 1,
    latin: 1,
    digit: 1,
    other: 1
  })
  assert.equal(stats.total.characters, 9)
  assert.equal(stats.skipped, 1)
})

test('statistics retain duplicate occurrences, UTF-16 frequency ties and empty splits', () => {
  const rows: SplitRow[] = [
    sample('2😀\uE000'),
    { ...sample('2😀\uE000', 'duplicate'), split: 'train' },
    { ...sample('Aa'), split: 'val' },
    { ...sample('pending'), text: null },
    { ...sample('excluded'), excluded: true }
  ]
  const original = structuredClone(rows)
  const stats = splitStatistics(rows)

  assert.equal(stats.total.images, 3)
  assert.equal(stats.total.nicknames, 2)
  assert.equal(stats.total.characters, 8)
  assert.equal(stats.skipped, 2)
  assert.deepEqual(stats.total.frequencies, [
    { character: '2', count: 2, group: 'digit' },
    { character: '😀', count: 2, group: 'special' },
    { character: '\uE000', count: 2, group: 'other' },
    { character: 'A', count: 1, group: 'latin' },
    { character: 'a', count: 1, group: 'latin' }
  ])
  assert.equal(stats.splits.train.images, 1)
  assert.equal(stats.splits.val.images, 1)
  assert.equal(stats.splits.unassigned.images, 1)
  assert.deepEqual(stats.splits.test, {
    images: 0,
    nicknames: 0,
    characters: 0,
    groups: {
      hangul: 0,
      special: 0,
      hiragana: 0,
      katakana: 0,
      hanja: 0,
      latin: 0,
      digit: 0,
      other: 0
    },
    frequencies: []
  })
  assert.deepEqual(rows, original)
})

test('assignment output uses UTF-16 text order without changing input rows', () => {
  const rows = ['\uE000', '😀', 'a', 'A', '2', '10'].map((text) => sample(text))
  const original = structuredClone(rows)
  const plan = planSplits(rows, {
    ratios: { train: 100, val: 0, test: 0 },
    replaceExisting: false
  })

  assert.deepEqual(
    plan.assignments,
    ['10', '2', 'A', 'a', '😀', '\uE000'].map((text) => ({ text, split: 'train' }))
  )
  assert.deepEqual(rows, original)
})

test('deterministic grouped stratification retains common character distributions without requiring rare coverage', () => {
  const rows = Array.from({ length: 100 }, (_, i) =>
    sample(`검사★${String.fromCodePoint(0x4e00 + i)}`)
  )
  const plan = planSplits(rows, options)
  assert.deepEqual(plan, planSplits([...rows].reverse(), options))
  for (const split of ['train', 'val', 'test'] as const) {
    assert.equal(plan.after.splits[split].images, options.ratios[split])
    assert.equal(plan.after.splits[split].groups.special, options.ratios[split])
  }
  const uneven = planSplits(
    [...Array.from({ length: 9 }, (_, i) => sample('가', `${i}`)), sample('나'), sample('다')],
    options
  )
  assert.equal(uneven.assignments.length, 3)
  assert.equal(
    uneven.after.splits[uneven.assignments.find((row) => row.text === '가')!.split].images >= 9,
    true
  )
})

test('existing assignments stay unless replacement is explicit and proportions are supplied', () => {
  const rows = [{ ...sample('기존'), split: 'test' as const }, sample('새이름')]
  assert.equal(
    planSplits(rows, options).assignments.find((row) => row.text === '기존')!.split,
    'test'
  )
  const changed = planSplits(rows, {
    ratios: { train: 100, val: 0, test: 0 },
    replaceExisting: true
  })
  assert.equal(changed.reassignedNicknames, 1)
  for (const input of [
    {},
    { ...options, ratios: { train: 80, val: 10 } },
    { ...options, ratios: { train: 97, val: 2, test: 2 } },
    { ...options, ratios: { train: NaN, val: 0, test: 0 } }
  ]) {
    assert.throws(() => parseSplitOptions(input))
  }
  assert.deepEqual(
    parseSplitOptions({ ...options, ratios: { train: 97, val: 1.5, test: 1.5 } }).ratios,
    { train: 97, val: 1.5, test: 1.5 }
  )
})

test('preview is read-only; stale apply is atomic; initialization survives restart and new labels inherit assignments', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ocr-split-'))
  let store = new OcrStore(join(directory, 'data.sqlite'), 1024 * 1024)
  const add = (text: string, excluded = false) => {
    const input = parseUpload(upload())
    store.add(input.capture, input.png)
    return store.updateSample(`${input.capture.id}-1`, {
      text,
      excluded,
      confirmSplitChange: false
    })
  }
  try {
    const first = add('가')
    const duplicate = add('가')
    add('나')
    add('다')
    const preview = store.previewSplit(options)
    assert.equal(store.sample(first.id).split, 'unassigned')
    assert.equal(preview.before.total.nicknames, 3)
    store.updateSample(first.id, { text: '가', excluded: true, confirmSplitChange: false })
    assert.throws(() => store.applySplit(options, preview.fingerprint), {
      code: 'SPLIT_PREVIEW_STALE'
    })
    assert.equal(store.splitStats().initialized, false)
    const fresh = store.previewSplit(options)
    store.applySplit(options, fresh.fingerprint)
    assert.equal(store.sample(first.id).split, store.sample(duplicate.id).split)
    store.close()
    store = new OcrStore(join(directory, 'data.sqlite'), 1024 * 1024)
    assert.equal(store.splitStats().initialized, true)
    store.assign('가', 'val')
    assert.equal(add('가').split, 'val')
    assert.equal(add('라').split, 'train')
    assert.equal(store.sample(first.id).split, 'val')
    assert.throws(
      () =>
        store.updateSample(first.id, { text: '다른', excluded: false, confirmSplitChange: false }),
      { code: 'LABEL_SPLIT_CHANGE' }
    )
    assert.equal(store.sample(first.id).text, '가')
    const excluded = add('보류', true)
    assert.equal(
      store.updateSample(excluded.id, { text: '보류', excluded: false, confirmSplitChange: false })
        .split,
      'train'
    )
    store.assign('라', 'unassigned')
    const unassigned = add('라')
    assert.equal(unassigned.split, 'unassigned')
    for (const row of store.exportManifest().samples.filter((sample) => sample.text === '라')) {
      store.updateSample(row.id, { text: '라', excluded: true, confirmSplitChange: false })
    }
    assert.equal(add('라').split, 'unassigned')
    assert.equal(
      store.updateSample(unassigned.id, { text: '라', excluded: false, confirmSplitChange: false })
        .split,
      'unassigned'
    )
  } finally {
    store.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test('automatic split preserves manual unassignment through preview, apply and restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ocr-protected-split-'))
  const database = join(directory, 'data.sqlite')
  let store = new OcrStore(database, 1024 * 1024)
  const add = (text: string) => {
    const input = parseUpload(upload())
    store.add(input.capture, input.png)
    return store.updateSample(`${input.capture.id}-1`, {
      text,
      excluded: false,
      confirmSplitChange: false
    })
  }
  try {
    const held = add('가')
    add('가')
    add('나')
    store.assign('가', 'unassigned')

    for (const replaceExisting of [false, true]) {
      const settings = { ...options, replaceExisting }
      const preview = store.previewSplit(settings)
      assert.equal(
        preview.assignments.some((row) => row.text === '가'),
        false
      )
      assert.equal(preview.after.splits.unassigned.images, 2)
      store.applySplit(settings, preview.fingerprint)
      assert.equal(store.sample(held.id).split, 'unassigned')
    }

    store.close()
    store = new OcrStore(database, 1024 * 1024)
    assert.equal(add('가').split, 'unassigned')
    store.assign('가', 'val')
    assert.equal(add('가').split, 'val')
  } finally {
    store.close()
    await rm(directory, { recursive: true, force: true })
  }
})

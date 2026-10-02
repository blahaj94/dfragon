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
  isImprovingSplitMove,
  SPLIT_IMPROVEMENT_POLICY,
  type SplitRow,
  type SplitOptions
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

test('분할 개선 점수와 비율 합의 엄격한 허용 경계를 유지한다', () => {
  assert.equal(SPLIT_IMPROVEMENT_POLICY.maximumPasses, 8)
  assert.equal(isImprovingSplitMove(-1e-12), false)
  assert.equal(isImprovingSplitMove(-0.999e-12), false)
  assert.equal(isImprovingSplitMove(-1.001e-12), true)
  assert.equal(isImprovingSplitMove(0), false)
  for (const delta of [-0.999e-6, 0, 0.999e-6]) {
    parseSplitOptions({ ...options, ratios: { train: 60 + delta, val: 20, test: 20 } })
  }
  for (const delta of [-1.001e-6, 1.001e-6]) {
    assert.throws(
      () => parseSplitOptions({ ...options, ratios: { train: 60 + delta, val: 20, test: 20 } }),
      { code: 'INVALID_INPUT' }
    )
  }
})

test('흔한·희귀 문자와 반복 닉네임의 기존 배정·독립 문자 집계를 함께 보존한다', () => {
  const names = [
    '가가★',
    '가나★',
    '가다★',
    '나나★',
    '나다★',
    '다다★',
    '龍가',
    '龍나',
    'あ가',
    'ア나',
    'A2가',
    '희귀😀'
  ]
  const rows = names.flatMap((text, group) =>
    Array.from({ length: (group % 3) + 1 }, (_, index) => sample(text, `${group}-${index}`))
  )
  const plan = planSplits(rows, options)
  assert.deepEqual(plan, planSplits([...rows].reverse(), options))
  // README에 기록한 점수·정렬·동률 정책의 기존 회귀 기대값은 유지한다.
  assert.deepEqual(plan.assignments, [
    { text: 'A2가', split: 'train' },
    { text: 'あ가', split: 'train' },
    { text: 'ア나', split: 'train' },
    { text: '龍가', split: 'test' },
    { text: '龍나', split: 'train' },
    { text: '가가★', split: 'val' },
    { text: '가나★', split: 'test' },
    { text: '가다★', split: 'val' },
    { text: '나나★', split: 'train' },
    { text: '나다★', split: 'test' },
    { text: '다다★', split: 'train' },
    { text: '희귀😀', split: 'train' }
  ])
  assert.equal(plan.assignments.length, 12)
  assert.deepEqual(new Set(plan.assignments.map(({ text }) => text)), new Set(names))
  assert.equal(plan.before.total.images, 24)
  assert.equal(plan.before.total.nicknames, 12)
  assert.equal(plan.before.total.characters, 65)
  assert.deepEqual(plan.after.total, plan.before.total)
  for (const split of ['train', 'val', 'test'] as const) {
    const assignedNames = new Set(
      plan.assignments.filter((assignment) => assignment.split === split).map(({ text }) => text)
    )
    const expectedRows = rows.filter((row) => assignedNames.has(row.text!))
    assert.equal(plan.after.splits[split].images, expectedRows.length)
    assert.equal(plan.after.splits[split].nicknames, assignedNames.size)
    assert.equal(
      plan.after.splits[split].characters,
      expectedRows.reduce((count, row) => count + [...row.text!].length, 0)
    )
    // 이 fixture의 최대 닉네임 묶음은 3장이다. 묶음을 쪼개지 않은 비율 근사를 검사한다.
    assert(Math.abs(expectedRows.length - (24 * options.ratios[split]) / 100) <= 3)
  }
})

test('문자군 통계는 영문·숫자·기타 문자를 구분해 정답 내 문자 등장 횟수를 센다', () => {
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

test('문자 통계는 반복 표본·빈 분할과 같은 빈도 문자의 UTF-16 순서를 보존한다', () => {
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

test('분할 결과는 UTF-16 닉네임 순서로 반환하고 입력 표본을 바꾸지 않는다', () => {
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

test('닉네임 묶음 분할은 입력 순서와 무관하게 흔한 문자의 목표 비율을 근사한다', () => {
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

test('명시 재배정 없이 기존 분할을 유지하고 비율 입력의 유효성을 검사한다', () => {
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

test('분할 미리보기는 읽기 전용이며 오래된 적용을 거절하고 재시작 뒤 신규 정답 배정을 유지한다', async () => {
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

test('수동 미배정 닉네임은 자동 분할 미리보기·적용·재시작 뒤에도 보존한다', async () => {
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

test('자료·정답·제외·배정·초기화·비율이 바뀌면 오래된 분할 적용을 거절하고 현재 상태를 보존한다', async (t) => {
  const cases: {
    title: string
    change: (store: OcrStore, id: string, settings: SplitOptions) => SplitOptions
  }[] = [
    {
      title: '미작성 캡처 추가',
      change: (store, _id, settings) => {
        const incoming = parseUpload(upload())
        store.add(incoming.capture, incoming.png)

        return settings
      }
    },
    {
      title: '정답 변경',
      change: (store, id, settings) => {
        store.updateSample(id, { text: '라', confirmSplitChange: true })

        return settings
      }
    },
    {
      title: '제외 상태 변경',
      change: (store, id, settings) => {
        store.updateSample(id, { excluded: true })

        return settings
      }
    },
    {
      title: '닉네임 배정 변경',
      change: (store, _id, settings) => {
        store.assign('가', 'val')

        return settings
      }
    },
    {
      title: '수동 미배정 선택',
      change: (store, _id, settings) => {
        store.assign('가', 'unassigned')

        return settings
      }
    },
    {
      title: '기존 배정 그대로 자동 추가 초기화',
      change: (store, _id, settings) => {
        store.applySplit(settings, store.previewSplit(settings).fingerprint)

        return settings
      }
    },
    {
      title: '비율 변경',
      change: (_store, _id, settings) => {
        const ratios = { train: 0, val: 100, test: 0 }

        return { ...settings, ratios }
      }
    },
    {
      title: '재배정 선택 변경',
      change: (_store, _id, settings) => {
        return { ...settings, replaceExisting: true }
      }
    }
  ]
  for (const scenario of cases) {
    await t.test(scenario.title, () => {
      const store = new OcrStore(':memory:', 1024 * 1024)
      try {
        let id = ''
        for (const text of ['가', '나', '다']) {
          const image = parseUpload(upload())
          store.add(image.capture, image.png)
          id = `${image.capture.id}-1`
          store.updateSample(id, { text })
          store.assign(text, 'train')
        }
        const preview = store.previewSplit(options)
        const changedOptions = scenario.change(store, id, options)
        const beforeRejectedApply = store.exportManifest()
        const current = store.previewSplit(changedOptions)
        assert.notEqual(current.fingerprint, preview.fingerprint)

        assert.throws(() => store.applySplit(changedOptions, preview.fingerprint), {
          code: 'SPLIT_PREVIEW_STALE'
        })
        const afterRejectedApply = store.exportManifest()
        assert.deepEqual(afterRejectedApply.captures, beforeRejectedApply.captures)
        assert.deepEqual(afterRejectedApply.samples, beforeRejectedApply.samples)
        assert.equal(store.splitStats().initialized, current.initialized)
        assert.equal(store.previewSplit(changedOptions).fingerprint, current.fingerprint)

        store.applySplit(changedOptions, current.fingerprint)
        assert.equal(store.splitStats().initialized, true)
      } finally {
        store.close()
      }
    })
  }
})

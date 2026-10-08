import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { OcrStore } from '../src/store.js'
import { parseTestCapture, parseTestUploadEnabled } from '../src/test-capture.js'
import { parseUpload } from '../src/images.js'
import { testCapture, upload } from './fixtures.js'

test('테스트 수집은 명시 설정에서만 켜지고 알 수 없는 설정은 시작 실패로 처리한다', () => {
  assert.equal(parseTestUploadEnabled(undefined), false)
  assert.equal(parseTestUploadEnabled('false'), false)
  assert.equal(parseTestUploadEnabled('true'), true)
  for (const value of ['', '1', 'yes', 'TRUE']) {
    assert.throws(() => parseTestUploadEnabled(value), { message: 'Invalid OCR configuration' })
  }
})

test('닉네임과 얼굴을 포함한 슬롯을 별도로 저장하고 예측을 정답이나 분할로 쓰지 않는다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ocr-test-collection-'))
  const path = join(directory, 'ocr.sqlite')
  const input = testCapture()
  let store = new OcrStore(path, 1024 * 1024)
  try {
    const { capture, png } = parseTestCapture(input)
    assert.deepEqual(store.add(capture, png), { id: input.id, duplicate: false })
    store.close()
    store = new OcrStore(path, 1024 * 1024)
    const sample = store.sample(`${input.id}-1`)
    assert.equal(sample.text, null)
    assert.equal(sample.split, 'unassigned')
    assert.equal(sample.excluded, false)
    assert.deepEqual(sample.testCollection, {
      trigger: 'ocr',
      context: { slot: 1, x: 0, y: 0, width: 4, height: 4 },
      prediction: '잘못된예측'
    })
    assert.deepEqual(store.capture(input.id).png, png)
    assert.deepEqual(store.capture(input.id).capture.crops, input.crops)
    assert.deepEqual(
      store.exportManifest().samples.map(({ text, split }) => ({ text, split })),
      [
        { text: null, split: 'unassigned' },
        { text: null, split: 'unassigned' }
      ]
    )
    assert.deepEqual(store.add(capture, png), { id: input.id, duplicate: true })
    const repeated = parseTestCapture({
      ...input,
      id: randomUUID(),
      capturedAt: '2026-10-08T01:00:00.000Z'
    })
    assert.deepEqual(store.add(repeated.capture, repeated.png), { id: input.id, duplicate: true })
    assert.equal(store.stats()?.captures, 1)
    assert.equal(store.stats()?.samples, 2)

    const changed = structuredClone(input)
    changed.testCollection.slots[0].prediction = '수정된예측'
    const conflict = parseTestCapture(changed)
    assert.throws(() => store.add(conflict.capture, conflict.png), { code: 'CAPTURE_ID_CONFLICT' })
    assert.equal(store.sample(`${input.id}-1`).testCollection?.prediction, '잘못된예측')
  } finally {
    store.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test('테스트 수집은 정답 주입, 잘못된 슬롯 매핑, 영역과 예측을 저장 전에 거절한다', () => {
  const fixture = testCapture()
  const mutations: ((body: Record<string, unknown>) => void)[] = [
    (body) => {
      body.text = '임의정답'
    },
    (body) => {
      body.kind = 'raid'
    },
    (body) => {
      body.testCollection = { ...fixture.testCollection, contentSha256: 'forged' }
    },
    (body) => {
      body.testCollection = { trigger: 'unknown', slots: fixture.testCollection.slots }
    },
    (body) => {
      body.testCollection = { trigger: 'shortcut', slots: fixture.testCollection.slots }
    },
    (body) => {
      body.testCollection = { trigger: 'ocr', slots: fixture.testCollection.slots.slice(1) }
    },
    (body) => {
      body.testCollection = {
        trigger: 'ocr',
        slots: [fixture.testCollection.slots[0], fixture.testCollection.slots[0]]
      }
    },
    ...[
      { slot: 2 },
      { x: -1 },
      { y: 0.5 },
      { width: 0 },
      { height: 5 },
      { x: 2, width: 2 },
      { prediction: undefined },
      { prediction: 'x'.repeat(129) },
      { text: '주입정답' }
    ].map((change) => (body: Record<string, unknown>) => {
      body.testCollection = {
        trigger: 'ocr',
        slots: [{ ...fixture.testCollection.slots[0], ...change }, fixture.testCollection.slots[1]]
      }
    })
  ]
  for (const mutate of mutations) {
    const body: Record<string, unknown> = structuredClone(fixture)
    mutate(body)
    assert.throws(() => parseTestCapture(body), { code: 'INVALID_INPUT' })
  }
  const shortcut = structuredClone(fixture)
  shortcut.testCollection.trigger = 'shortcut'
  shortcut.testCollection.slots.forEach((slot) => {
    slot.prediction = null
  })
  assert.equal(parseTestCapture(shortcut).capture.testCollection?.trigger, 'shortcut')
})

test('테스트 수집은 통합 저장 한도를 넘어도 받고 기존 일반 업로드 한도는 유지한다', () => {
  const store = new OcrStore(':memory:', 1)
  try {
    const { capture, png } = parseTestCapture(testCapture())
    assert.deepEqual(store.add(capture, png), { id: capture.id, duplicate: false })
    assert.equal(store.stats()?.captures, 1)
    assert.equal(store.stats()?.samples, capture.crops.length)
    const regular = parseUpload(upload())
    assert.throws(() => store.add(regular.capture, regular.png), { code: 'STORAGE_LIMIT' })
    assert.equal(store.stats()?.captures, 1)
  } finally {
    store.close()
  }
})

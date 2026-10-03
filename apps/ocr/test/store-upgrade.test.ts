import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { OcrStore } from '../src/store.js'

// PR #546 이전 스키마를 새 생성자와 독립된 fixture로 보존한다.
const legacySchema = `
  PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;
  CREATE TABLE IF NOT EXISTS captures(id TEXT PRIMARY KEY, metadata TEXT NOT NULL, fingerprint TEXT NOT NULL, png BLOB NOT NULL);
  CREATE TABLE IF NOT EXISTS samples(id TEXT PRIMARY KEY, capture_id TEXT NOT NULL REFERENCES captures(id), slot INTEGER NOT NULL, text TEXT, excluded INTEGER NOT NULL DEFAULT 0, UNIQUE(capture_id,slot));
  CREATE TABLE IF NOT EXISTS label_splits(text TEXT PRIMARY KEY, split TEXT NOT NULL CHECK(split IN ('train','val','test')));
  CREATE INDEX IF NOT EXISTS samples_text ON samples(text);
  CREATE TABLE IF NOT EXISTS models(id TEXT PRIMARY KEY, metadata TEXT NOT NULL, fingerprint TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS model_files(model_id TEXT NOT NULL REFERENCES models(id), name TEXT NOT NULL, data BLOB NOT NULL, PRIMARY KEY(model_id,name));
`
const tables = ['captures', 'samples', 'label_splits', 'models', 'model_files'] as const

test('자동 분할 도입 전 SQLite를 열면 빈 설정 테이블만 추가하고 기존 자료를 재시작 뒤 보존한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ocr-upgrade-'))
  const path = join(directory, 'ocr.sqlite')
  let database = new DatabaseSync(path)
  try {
    database.exec(legacySchema)
    database
      .prepare('INSERT INTO captures VALUES (?, ?, ?, ?)')
      .run('capture', '{"kind":"hud"}', 'original-hash', Buffer.from([0, 255, 1, 2]))
    const names = ['학습', '검증', '테스트', '미배정', null]
    for (const [slot, name] of names.entries()) {
      database
        .prepare('INSERT INTO samples VALUES (?, ?, ?, ?, ?)')
        .run(`sample-${slot}`, 'capture', slot + 1, name, slot === 3 ? 1 : 0)
    }
    for (const [index, split] of ['train', 'val', 'test'].entries()) {
      database.prepare('INSERT INTO label_splits VALUES (?, ?)').run(names[index], split)
    }
    database
      .prepare('INSERT INTO models VALUES (?, ?, ?)')
      .run('model', '{"kind":"pretrained"}', 'model-hash')
    database
      .prepare('INSERT INTO model_files VALUES (?, ?, ?)')
      .run('model', 'weights.pdparams', Buffer.from([3, 0, 255, 4]))
    const before = tables.map((name) => database.prepare(`SELECT rowid, * FROM ${name}`).all())
    database.close()

    for (let reopen = 0; reopen < 2; reopen++) {
      const store = new OcrStore(path, 1024 * 1024)
      try {
        assert.equal(store.splitStats().initialized, false)
      } finally {
        store.close()
      }
      database = new DatabaseSync(path)
      // 서버 이미지만 되돌려도 이전 생성자가 같은 DB를 열 수 있어야 한다.
      database.exec(legacySchema)
      assert.deepEqual(
        tables.map((name) => database.prepare(`SELECT rowid, * FROM ${name}`).all()),
        before
      )
      for (const name of ['settings', 'label_unassigned']) {
        assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM ${name}`).get()?.count, 0)
      }
      assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), [])
      database.close()
    }
  } finally {
    if (database.isOpen) {
      database.close()
    }
    await rm(directory, { recursive: true, force: true })
  }
})

import { OCR_SAMPLES } from './constants.js'
import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { OCR_ERROR_CODE, OcrError } from './errors.js'
import type { Capture, Sample, Split, ModelSummary, ModelUpload } from './model.js'
import { inspectModelFiles } from './model-library.js'

type CaptureRow = { metadata: string; png: Uint8Array; fingerprint: string }
const sampleQuery = `SELECT s.*, c.metadata, COALESCE(g.split,'unassigned') AS split
 FROM samples s JOIN captures c ON c.id=s.capture_id LEFT JOIN label_splits g ON g.text=s.text`

export class OcrStore {
  private readonly db: DatabaseSync

  constructor(
    path: string,
    private readonly maximumBytes: number
  ) {
    this.db = new DatabaseSync(path)
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS captures(id TEXT PRIMARY KEY, metadata TEXT NOT NULL, fingerprint TEXT NOT NULL, png BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS samples(id TEXT PRIMARY KEY, capture_id TEXT NOT NULL REFERENCES captures(id), slot INTEGER NOT NULL, text TEXT, excluded INTEGER NOT NULL DEFAULT 0, UNIQUE(capture_id,slot));
      CREATE TABLE IF NOT EXISTS label_splits(text TEXT PRIMARY KEY, split TEXT NOT NULL CHECK(split IN ('train','val','test')));
      CREATE INDEX IF NOT EXISTS samples_text ON samples(text);
      CREATE TABLE IF NOT EXISTS models(id TEXT PRIMARY KEY, metadata TEXT NOT NULL, fingerprint TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS model_files(model_id TEXT NOT NULL REFERENCES models(id), name TEXT NOT NULL, data BLOB NOT NULL, PRIMARY KEY(model_id,name));`)
  }

  close() {
    this.db.close()
  }

  models(): ModelSummary[] {
    return this.db
      .prepare('SELECT metadata FROM models ORDER BY rowid DESC')
      .all()
      .map((row) => JSON.parse(row.metadata as string) as ModelSummary)
  }

  model(id: string): ModelSummary {
    const row = this.db.prepare('SELECT metadata FROM models WHERE id=?').get(id)
    if (row === undefined) {
      throw new OcrError(OCR_ERROR_CODE.NOT_FOUND)
    }
    return JSON.parse(row.metadata as string) as ModelSummary
  }

  modelFile(id: string, name: string): Buffer {
    const row = this.db
      .prepare('SELECT data FROM model_files WHERE model_id=? AND name=?')
      .get(id, name)
    if (row === undefined) {
      throw new OcrError(OCR_ERROR_CODE.NOT_FOUND)
    }
    return Buffer.from(row.data as Uint8Array)
  }

  addModel(
    input: ModelUpload,
    content: Map<string, Buffer>
  ): { model: ModelSummary; duplicate: boolean } {
    const files = inspectModelFiles(content)
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ ...input, files }))
      .digest('hex')
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const existing = this.db.prepare('SELECT fingerprint FROM models WHERE id=?').get(input.id)
      if (existing !== undefined) {
        if (existing.fingerprint !== fingerprint) {
          throw new OcrError(OCR_ERROR_CODE.MODEL_ID_CONFLICT)
        }
        const model = this.model(input.id)
        this.db.exec('COMMIT')
        return { model, duplicate: true }
      }
      if (input.parentId !== null) {
        const parent = this.model(input.parentId)
        if (
          parent.preset !== input.preset ||
          parent.files.find((file) => file.name === 'characters.txt')?.sha256 !==
            files.find((file) => file.name === 'characters.txt')?.sha256
        ) {
          throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
        }
      }
      const used = this.db
        .prepare(
          'SELECT (SELECT COALESCE(SUM(length(png)),0) FROM captures) + (SELECT COALESCE(SUM(length(data)),0) FROM model_files) AS bytes'
        )
        .get()!
      if (
        Number(used.bytes) + files.reduce((sum, file) => sum + file.bytes, 0) >
        this.maximumBytes
      ) {
        throw new OcrError(OCR_ERROR_CODE.STORAGE_LIMIT)
      }
      const model: ModelSummary = { ...input, registeredAt: new Date().toISOString(), files }
      this.db
        .prepare('INSERT INTO models VALUES(?,?,?)')
        .run(input.id, JSON.stringify(model), fingerprint)
      const insert = this.db.prepare('INSERT INTO model_files VALUES(?,?,?)')
      for (const [name, bytes] of content) {
        insert.run(input.id, name, bytes)
      }
      this.db.exec('COMMIT')
      return { model, duplicate: false }
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  add(capture: Capture, png: Buffer) {
    const metadata = JSON.stringify(capture)
    const fingerprint = createHash('sha256').update(metadata).update(png).digest('hex')

    this.db.exec('BEGIN IMMEDIATE')
    try {
      const existing = this.db
        .prepare('SELECT fingerprint FROM captures WHERE id=?')
        .get(capture.id)
      if (existing !== undefined) {
        if (existing.fingerprint !== fingerprint) {
          throw new OcrError(OCR_ERROR_CODE.CAPTURE_ID_CONFLICT)
        }
        this.db.exec('COMMIT')
        return { id: capture.id, duplicate: true }
      }

      const used = this.db
        .prepare(
          'SELECT (SELECT COALESCE(SUM(length(png)),0) FROM captures) + (SELECT COALESCE(SUM(length(data)),0) FROM model_files) AS bytes'
        )
        .get()!
      if (Number(used.bytes) + png.length > this.maximumBytes) {
        throw new OcrError(OCR_ERROR_CODE.STORAGE_LIMIT)
      }

      this.db
        .prepare('INSERT INTO captures VALUES(?,?,?,?)')
        .run(capture.id, metadata, fingerprint, png)
      const insert = this.db.prepare('INSERT INTO samples(id,capture_id,slot) VALUES(?,?,?)')
      for (const crop of capture.crops) {
        insert.run(`${capture.id}-${crop.slot}`, capture.id, crop.slot)
      }

      this.db.exec('COMMIT')
      return { id: capture.id, duplicate: false }
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  capture(id: string): { capture: Capture; png: Buffer } {
    const row = this.db.prepare('SELECT metadata,png FROM captures WHERE id=?').get(id) as
      CaptureRow | undefined
    if (row === undefined) {
      throw new OcrError(OCR_ERROR_CODE.NOT_FOUND)
    }

    return { capture: JSON.parse(row.metadata) as Capture, png: Buffer.from(row.png) }
  }

  private sampleRow(row: Record<string, unknown>): Sample {
    const capture = JSON.parse(row.metadata as string) as Capture
    // 원본 메타데이터와 sample 행은 같은 transaction에서 저장한다.
    const crop = capture.crops.find((crop) => crop.slot === row.slot)
    if (crop === undefined) {
      throw new OcrError(OCR_ERROR_CODE.UNAVAILABLE)
    }

    return {
      ...crop,
      id: row.id as string,
      captureId: capture.id,
      capturedAt: capture.capturedAt,
      kind: capture.kind,
      frameWidth: capture.width,
      frameHeight: capture.height,
      uiScale: capture.uiScale,
      uiScaleSource: capture.uiScaleSource,
      text: row.text as string | null,
      excluded: row.excluded === 1,
      split: row.split as Split
    }
  }

  sample(id: string): Sample {
    const row = this.db.prepare(`${sampleQuery} WHERE s.id=?`).get(id)
    if (row === undefined) {
      throw new OcrError(OCR_ERROR_CODE.NOT_FOUND)
    }
    return this.sampleRow(row)
  }

  list(options: { offset: number; state?: string; split?: string; kind?: string; text?: string }) {
    const clauses: string[] = []
    const args: (string | number)[] = []
    if (options.state === 'excluded') {
      clauses.push('s.excluded=1')
    }
    if (options.state === 'pending') {
      clauses.push('s.excluded=0 AND s.text IS NULL')
    }
    if (options.state === 'labeled') {
      clauses.push('s.excluded=0 AND s.text IS NOT NULL')
    }
    if (options.split !== undefined && options.split.length > 0) {
      clauses.push("COALESCE(g.split,'unassigned')=?")
      args.push(options.split)
    }
    if (options.kind !== undefined && options.kind.length > 0) {
      clauses.push("json_extract(c.metadata,'$.kind')=?")
      args.push(options.kind)
    }
    if (options.text !== undefined && options.text.length > 0) {
      clauses.push('s.text=?')
      args.push(options.text.normalize('NFC'))
    }

    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : ''
    const rows = this.db
      .prepare(
        `${sampleQuery}${where} ORDER BY c.rowid DESC,s.slot LIMIT ${OCR_SAMPLES.pageSize + 1} OFFSET ?`
      )
      .all(...args, options.offset)

    return {
      samples: rows.slice(0, OCR_SAMPLES.pageSize).map((row) => this.sampleRow(row)),
      nextOffset: rows.length > OCR_SAMPLES.pageSize ? options.offset + OCR_SAMPLES.pageSize : null
    }
  }

  updateSample(
    id: string,
    {
      text,
      excluded,
      confirmSplitChange
    }: { text: string | null; excluded: boolean; confirmSplitChange: boolean }
  ) {
    const previousSample = this.sample(id)
    const target =
      text === null
        ? undefined
        : this.db.prepare('SELECT split FROM label_splits WHERE text=?').get(text)
    const nextSplit = (target?.split ?? 'unassigned') as Split
    if (
      text !== previousSample.text &&
      previousSample.split !== 'unassigned' &&
      previousSample.split !== nextSplit &&
      !confirmSplitChange
    ) {
      throw new OcrError(OCR_ERROR_CODE.LABEL_SPLIT_CHANGE)
    }

    this.db
      .prepare('UPDATE samples SET text=?,excluded=? WHERE id=?')
      .run(text, Number(excluded), id)
    return this.sample(id)
  }

  assign(text: string, split: Split) {
    const count = this.db.prepare('SELECT COUNT(*) AS count FROM samples WHERE text=?').get(text)!
    if (Number(count.count) === 0) {
      throw new OcrError(OCR_ERROR_CODE.NOT_FOUND)
    }
    if (split === 'unassigned') {
      this.db.prepare('DELETE FROM label_splits WHERE text=?').run(text)
    } else {
      this.db
        .prepare(
          'INSERT INTO label_splits VALUES(?,?) ON CONFLICT(text) DO UPDATE SET split=excluded.split'
        )
        .run(text, split)
    }

    return { text, split, affected: Number(count.count) }
  }

  stats() {
    return this.db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM captures) AS captures,COUNT(*) AS samples,
      COALESCE(SUM(text IS NULL AND excluded=0),0) AS pending,COALESCE(SUM(excluded=1),0) AS excluded,
      (SELECT COALESCE(SUM(length(png)),0) FROM captures) AS storedBytes FROM samples`
      )
      .get()
  }

  /** Metadata is read together before streaming; image bytes are immutable. No persistent dataset versions. */
  exportManifest() {
    const captures = this.db
      .prepare('SELECT metadata FROM captures ORDER BY rowid')
      .all()
      .map((row) => JSON.parse(row.metadata as string) as Capture)
    const samples = this.db
      .prepare(`${sampleQuery} ORDER BY c.rowid,s.slot`)
      .all()
      .map((row) => this.sampleRow(row))

    return { schemaVersion: 1, exportedAt: new Date().toISOString(), captures, samples }
  }
}

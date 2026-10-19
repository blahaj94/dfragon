import { readFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { PNG } from 'pngjs'
import type { DNFRaidValueColumnKind } from '@dfragon/lib'
import type { CharacterImage } from '../../src/preload/common/types/character'

const MANIFEST_FILE = 'manifest.json'
export const COLUMN_KINDS: readonly DNFRaidValueColumnKind[] = [
  'fame',
  'equipment-score',
  'unknown'
]

/** 정답을 아는 상태에서 따로 모은 동명 후보 값이다. 이 도구는 네트워크를 쓰지 않는다. */
export type ManifestCandidate = Readonly<{
  correct: boolean
  fame: number | null
  jobName: string | null
  jobGrowName: string | null
  /** 후보 상세로 점수 엔진이 계산한 값. 계산하지 못했으면 null이다. */
  engineScore: number | null
}>

export type ManifestRow = Readonly<{
  row: number
  /** 잘리지 않은 전체 직업명. 화면에 보이는 `眞 직업명` 형식으로 적는다. */
  jobGrowName: string
  /** 화면에 실제로 보이는 직업명. 돋보기 앞에서 잘린 행은 보이는 글자까지만 적는다. */
  visibleJobText: string
  jobClipped: boolean
  /** 화면의 수치 표기 그대로(`12,345`, `1000.4K`). */
  valueText: string
  /** 같은 이름의 후보가 1명뿐인지. 확인하지 못했으면 null이다. */
  uniqueName: boolean | null
  candidates: readonly ManifestCandidate[]
}>

export type ManifestCase = Readonly<{
  id: string
  image: string
  columnKind: DNFRaidValueColumnKind
  rows: readonly ManifestRow[]
}>

export type Manifest = Readonly<{ directory: string; cases: readonly ManifestCase[] }>

type JsonObject = Readonly<Record<string, unknown>>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(where: string, message: string): never {
  throw new TypeError(`manifest ${where}: ${message}`)
}

function readText(value: unknown, where: string): string {
  if (typeof value !== 'string' || value === '') {
    fail(where, '비어 있지 않은 문자열이어야 합니다')
  }

  return value
}

function readNullableText(value: unknown, where: string): string | null {
  if (value === undefined || value === null) {
    return null
  }

  return readText(value, where)
}

function readNullableNumber(value: unknown, where: string): number | null {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(where, '유한한 수나 null이어야 합니다')
  }

  return value
}

function parseCandidate(value: unknown, where: string): ManifestCandidate {
  if (!isObject(value)) {
    fail(where, '후보는 객체여야 합니다')
  }

  if (value.correct !== undefined && typeof value.correct !== 'boolean') {
    fail(where, 'correct는 boolean이어야 합니다')
  }
  const correct = value.correct === true

  return {
    correct,
    fame: readNullableNumber(value.fame, `${where}.fame`),
    jobName: readNullableText(value.jobName, `${where}.jobName`),
    jobGrowName: readNullableText(value.jobGrowName, `${where}.jobGrowName`),
    engineScore: readNullableNumber(value.engineScore, `${where}.engineScore`)
  }
}

function parseRow(value: unknown, where: string): ManifestRow {
  if (!isObject(value)) {
    fail(where, '행은 객체여야 합니다')
  }
  const { row, jobClipped } = value
  if (typeof row !== 'number' || !Number.isInteger(row) || row < 1 || row > 12) {
    fail(where, 'row는 1~12의 정수여야 합니다')
  }

  if (typeof jobClipped !== 'boolean') {
    fail(where, 'jobClipped는 boolean이어야 합니다')
  }

  const uniqueName = value.uniqueName ?? null
  if (uniqueName !== null && typeof uniqueName !== 'boolean') {
    fail(where, 'uniqueName은 boolean이나 null이어야 합니다')
  }
  const candidateValues = value.candidates ?? []
  if (!Array.isArray(candidateValues)) {
    fail(where, 'candidates는 배열이어야 합니다')
  }
  const candidates = candidateValues.map((candidate, index) =>
    parseCandidate(candidate, `${where}.candidates[${index}]`)
  )
  const correctCount = candidates.filter((candidate) => candidate.correct).length
  if (candidates.length > 0 && correctCount !== 1) {
    fail(where, `후보가 있으면 정답 후보는 정확히 1명이어야 합니다(현재 ${correctCount}명)`)
  }

  return {
    row,
    jobGrowName: readText(value.jobGrowName, `${where}.jobGrowName`),
    visibleJobText: readText(value.visibleJobText, `${where}.visibleJobText`),
    jobClipped,
    valueText: readText(value.valueText, `${where}.valueText`),
    uniqueName,
    candidates
  }
}

function parseCase(value: unknown, where: string): ManifestCase {
  if (!isObject(value)) {
    fail(where, '케이스는 객체여야 합니다')
  }
  const id = readText(value.id, `${where}.id`)
  const image = readText(value.image, `${where}.image`)
  if (isAbsolute(image)) {
    fail(where, 'image는 manifest 폴더 기준 상대 경로여야 합니다')
  }
  const columnKind = COLUMN_KINDS.find((kind) => kind === value.columnKind)
  if (columnKind === undefined) {
    fail(where, `columnKind는 ${COLUMN_KINDS.join(', ')} 중 하나여야 합니다`)
  }

  if (!Array.isArray(value.rows) || value.rows.length === 0) {
    fail(where, 'rows는 비어 있지 않은 배열이어야 합니다')
  }
  const rows = value.rows.map((row, index) => parseRow(row, `${where}.rows[${index}]`))
  if (new Set(rows.map((row) => row.row)).size !== rows.length) {
    fail(where, '행 번호가 중복됩니다')
  }

  return { id, image, columnKind, rows }
}

export function parseManifest(directory: string, json: unknown): Manifest {
  if (!isObject(json) || !Array.isArray(json.cases) || json.cases.length === 0) {
    fail('root', 'cases는 비어 있지 않은 배열이어야 합니다')
  }
  const cases = json.cases.map((entry, index) => parseCase(entry, `cases[${index}]`))
  if (new Set(cases.map((entry) => entry.id)).size !== cases.length) {
    fail('root', '케이스 id가 중복됩니다')
  }

  return { directory, cases }
}

export function readManifest(directory: string): Manifest {
  const root = resolve(directory)

  return parseManifest(root, JSON.parse(readFileSync(join(root, MANIFEST_FILE), 'utf8')))
}

export function readPng(file: string): CharacterImage {
  const png = PNG.sync.read(readFileSync(file))

  return { width: png.width, height: png.height, rgba: new Uint8Array(png.data) }
}

/** 케이스의 게임 client 원본을 읽는다. 표본이 커서 케이스를 평가할 때마다 읽고 버린다. */
export function loadCaseImage(manifest: Manifest, entry: ManifestCase): CharacterImage {
  const resolved = resolve(manifest.directory, entry.image)
  const fromRoot = relative(manifest.directory, resolved)
  if (fromRoot === '' || fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
    throw new RangeError(`manifest 경로가 표본 폴더 밖을 가리킵니다: ${entry.image}`)
  }

  return readPng(resolved)
}

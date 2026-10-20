import { readFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { PNG } from 'pngjs'
import type { CharacterImage } from '../../src/preload/common/types/character'

const MANIFEST_FILE = 'manifest.json'

export type ManifestCandidate = Readonly<{
  id: string
  /** manifest 폴더 기준 상대 경로. 이미지를 받지 못한 후보는 null이다. */
  image: string | null
  correct: boolean
  /** 후보의 기본 직업명. 직업별 얼굴 위치를 찾을 때 쓰며 없으면 null이다. */
  jobName: string | null
}>

export type ManifestCase = Readonly<{
  id: string
  hud: string
  rasterScale: number
  candidates: readonly ManifestCandidate[]
}>

export type Manifest = Readonly<{ directory: string; cases: readonly ManifestCase[] }>

export type LoadedCandidate = Readonly<{
  id: string
  correct: boolean
  jobName: string | null
  /** 이미지가 없는 후보는 null이며 점수를 구하지 않는다. */
  image: CharacterImage | null
}>

export type LoadedCase = Readonly<{
  id: string
  hud: CharacterImage
  rasterScale: number
  candidates: readonly LoadedCandidate[]
}>

type JsonObject = Readonly<Record<string, unknown>>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(where: string, message: string): never {
  throw new TypeError(`manifest ${where}: ${message}`)
}

function readId(value: unknown, where: string): string {
  if (typeof value !== 'string' || value === '') {
    fail(where, 'id는 비어 있지 않은 문자열이어야 합니다')
  }

  return value
}

function readPath(value: unknown, where: string): string {
  if (typeof value !== 'string' || value === '' || isAbsolute(value)) {
    fail(where, '경로는 manifest 폴더 기준 상대 경로여야 합니다')
  }

  return value
}

function parseCandidate(value: unknown, where: string): ManifestCandidate {
  if (!isObject(value)) {
    fail(where, '후보는 객체여야 합니다')
  }
  const id = readId(value.id, `${where}.id`)
  const image = value.image === null ? null : readPath(value.image, `${where}.image`)
  if (value.correct !== undefined && typeof value.correct !== 'boolean') {
    fail(where, 'correct는 boolean이어야 합니다')
  }
  const { jobName = null } = value
  if (jobName !== null && typeof jobName !== 'string') {
    fail(where, 'jobName은 문자열이나 null이어야 합니다')
  }
  const correct = value.correct === true

  return { id, image, correct, jobName }
}

function parseCase(value: unknown, where: string): ManifestCase {
  if (!isObject(value)) {
    fail(where, '케이스는 객체여야 합니다')
  }
  const id = readId(value.id, `${where}.id`)
  const hud = readPath(value.hud, `${where}.hud`)
  const { rasterScale } = value
  if (typeof rasterScale !== 'number' || !Number.isFinite(rasterScale) || rasterScale <= 0) {
    fail(where, 'rasterScale은 0보다 큰 유한한 수여야 합니다')
  }

  if (!Array.isArray(value.candidates) || value.candidates.length === 0) {
    fail(where, 'candidates는 비어 있지 않은 배열이어야 합니다')
  }
  const candidates = value.candidates.map((candidate, index) =>
    parseCandidate(candidate, `${where}.candidates[${index}]`)
  )
  if (new Set(candidates.map((candidate) => candidate.id)).size !== candidates.length) {
    fail(where, '후보 id가 중복됩니다')
  }
  const correctCount = candidates.filter((candidate) => candidate.correct).length
  if (correctCount !== 1) {
    fail(where, `정답 후보는 정확히 1명이어야 합니다(현재 ${correctCount}명)`)
  }

  return { id, hud, rasterScale, candidates }
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
  const text = readFileSync(join(root, MANIFEST_FILE), 'utf8')

  return parseManifest(root, JSON.parse(text))
}

function resolveInside(directory: string, path: string): string {
  const resolved = resolve(directory, path)
  const fromRoot = relative(directory, resolved)
  if (fromRoot === '' || fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
    throw new RangeError(`manifest 경로가 표본 폴더 밖을 가리킵니다: ${path}`)
  }

  return resolved
}

export function readPng(file: string): CharacterImage {
  const png = PNG.sync.read(readFileSync(file))

  return { width: png.width, height: png.height, rgba: new Uint8Array(png.data) }
}

/** 케이스 하나의 PNG를 읽는다. 표본이 커서 케이스를 평가할 때마다 읽고 버린다. */
export function loadCase(manifest: Manifest, entry: ManifestCase): LoadedCase {
  const hud = readPng(resolveInside(manifest.directory, entry.hud))
  const candidates = entry.candidates.map((candidate) => ({
    id: candidate.id,
    correct: candidate.correct,
    jobName: candidate.jobName,
    image:
      candidate.image === null ? null : readPng(resolveInside(manifest.directory, candidate.image))
  }))

  return { id: entry.id, rasterScale: entry.rasterScale, hud, candidates }
}

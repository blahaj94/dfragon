import { createHash } from 'node:crypto'
import { OCR_ERROR_CODE, OcrError } from './errors.js'
import { parseInputRecord } from './input.js'
import type { ModelSummary, ModelUpload } from './model.js'

export const MODEL_FILES = ['weights.pdparams', 'characters.txt', 'evaluation.json'] as const
export const MODEL_MAXIMUM_BYTES = 128 * 1024 * 1024
export const MODEL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const PADDLEOCR_REVISION = 'b03f46425e8ff4442b268ce449e3eef758146cd4'

export function parseModelUpload(value: unknown): ModelUpload {
  const body = parseInputRecord(value)
  if (
    Object.keys(body).sort().join(',') !== 'id,kind,name,parentId,preset' ||
    typeof body.id !== 'string' ||
    !MODEL_ID.test(body.id) ||
    typeof body.name !== 'string' ||
    body.name.trim().length === 0 ||
    body.name.length > 100 ||
    /[\p{Control}\p{Surrogate}]/u.test(body.name) ||
    body.preset !== 'korean-ppocrv5' ||
    (body.kind !== 'pretrained' && body.kind !== 'finetuned' && body.kind !== 'expanded') ||
    (body.parentId !== null &&
      (typeof body.parentId !== 'string' || !MODEL_ID.test(body.parentId))) ||
    (body.kind === 'pretrained' ? body.parentId !== null : body.parentId === null) ||
    body.parentId === body.id
  ) {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }

  return {
    id: body.id,
    name: body.name,
    preset: body.preset,
    kind: body.kind,
    parentId: body.parentId
  }
}

export function inspectModelFiles(files: Map<string, Buffer>): ModelSummary['files'] {
  if (
    !files.has('weights.pdparams') ||
    !files.has('characters.txt') ||
    [...files.keys()].some((name) => !MODEL_FILES.some((allowed) => name === allowed))
  ) {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }
  let total = 0
  const result: ModelSummary['files'] = []
  for (const name of MODEL_FILES) {
    const bytes = files.get(name)
    if (bytes === undefined) {
      continue
    }
    total += bytes.length
    if (
      bytes.length === 0 ||
      total > MODEL_MAXIMUM_BYTES ||
      (name !== 'weights.pdparams' && bytes.length > 1024 * 1024)
    ) {
      throw new OcrError(OCR_ERROR_CODE.UPLOAD_TOO_LARGE)
    }
    result.push({
      name,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex')
    })
  }
  let dictionary: string
  try {
    dictionary = new TextDecoder('utf-8', { fatal: true }).decode(files.get('characters.txt'))
    if (files.has('evaluation.json')) {
      const evaluation: unknown = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(files.get('evaluation.json'))
      )
      if (evaluation === null || typeof evaluation !== 'object' || Array.isArray(evaluation)) {
        throw new Error('Invalid evaluation')
      }
    }
  } catch {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }
  const characters = dictionary.replace(/\r?\n$/, '').split(/\r?\n/)
  if (
    characters.length === 0 ||
    characters.some(
      (char) => [...char].length !== 1 || /[\p{Control}\p{Surrogate}\uFEFF]/u.test(char)
    ) ||
    characters.includes(' ') ||
    new Set(characters).size !== characters.length
  ) {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }

  return result
}

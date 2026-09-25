import { OCR_SAMPLES } from './constants.js'
import { OCR_ERROR_CODE, OcrError } from './errors.js'
import type { Split } from './model.js'

export function parseInputRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }
  return value as Record<string, unknown>
}

export function parseLabel(value: unknown): string | null {
  if (value === null) {
    return null
  }
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > OCR_SAMPLES.maximumLabelLength
  ) {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }

  const hasControlCharacter = [...value].some((character) => {
    const codePoint = character.codePointAt(0)
    return codePoint !== undefined && (codePoint < 32 || codePoint === 127)
  })
  if (hasControlCharacter) {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }

  // 같은 Unicode 표기의 닉네임은 분할을 공유하고 대소문자·공백은 그대로 보존한다.
  return value.normalize('NFC')
}

export function parseSplit(value: unknown): Split {
  if (value !== 'unassigned' && value !== 'train' && value !== 'val' && value !== 'test') {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }
  return value
}

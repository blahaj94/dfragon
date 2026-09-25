import { isOcrErrorCode, OCR_ERRORS, OCR_ERROR_CODE } from '../src/errors.js'
import type { OcrErrorCode } from '../src/errors.js'

export class OcrApiError extends Error {
  constructor(readonly code: OcrErrorCode) {
    super(OCR_ERRORS[code].message)
    this.name = 'OcrApiError'
  }
}

export async function requestOcr<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method,
      signal,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })
  } catch {
    throw new OcrApiError(OCR_ERROR_CODE.UNAVAILABLE)
  }

  if (!response.ok) {
    const result: unknown = await response.json().catch(() => null)
    const code =
      typeof result === 'object' &&
      result !== null &&
      'error' in result &&
      isOcrErrorCode(result.error)
        ? result.error
        : OCR_ERROR_CODE.UNAVAILABLE
    throw new OcrApiError(code)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export function errorMessage(error: unknown): string {
  return error instanceof OcrApiError ? error.message : OCR_ERRORS.UNAVAILABLE.message
}

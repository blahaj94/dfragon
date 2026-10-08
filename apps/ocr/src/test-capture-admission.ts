import type { Request } from 'express'
import { OCR_ERROR_CODE, OcrError } from './errors.js'

/** 큰 본문을 읽기 전에 테스트 수집 설정과 자격 헤더만 확인한다. */
export function requireTestCaptureUpload(
  request: Pick<Request, 'headers'>,
  enabled: boolean
): void {
  if (!enabled) {
    throw new OcrError(OCR_ERROR_CODE.NOT_FOUND)
  }

  if (request.headers.authorization !== undefined || request.headers.cookie !== undefined) {
    throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
  }
}

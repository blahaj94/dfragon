import assert from 'node:assert/strict'
import test from 'node:test'
import { OCR_ERROR_CODE, OCR_ERRORS, OcrError, isOcrErrorCode } from '../src/errors.js'

test('오류 식별자, 타입 검증, 응답은 모든 오류 목록 항목에서 파생한다', () => {
  const invalidInput: 'INVALID_INPUT' = OCR_ERROR_CODE.INVALID_INPUT
  assert.equal(invalidInput, 'INVALID_INPUT')
  assert.deepEqual(Object.keys(OCR_ERROR_CODE).sort(), Object.keys(OCR_ERRORS).sort())
  for (const code of Object.keys(OCR_ERRORS)) {
    assert(isOcrErrorCode(code))
    assert.equal(OCR_ERROR_CODE[code], code)
    const error = new OcrError(code)
    assert.equal(error.status, OCR_ERRORS[code].status)
    assert.equal(error.message, OCR_ERRORS[code].message)
  }
  for (const value of ['UNKNOWN', 'toString', '__proto__', '', null, undefined, 400, {}]) {
    assert.equal(isOcrErrorCode(value), false)
  }
})

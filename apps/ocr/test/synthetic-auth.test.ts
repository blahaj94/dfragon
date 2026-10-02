import assert from 'node:assert/strict'
import test from 'node:test'
import { OcrAuth, parseSyntheticUploadTokenSha256 } from '../src/auth.js'

test('합성 업로드 설정은 생략을 허용하고 잘못된 해시를 원문 노출 없이 거절한다', () => {
  assert.equal(parseSyntheticUploadTokenSha256(undefined), undefined)
  assert.equal(parseSyntheticUploadTokenSha256('a'.repeat(64)), 'a'.repeat(64))
  for (const value of [
    '',
    'raw-token-for-tests',
    'a'.repeat(63),
    'A'.repeat(64),
    'z'.repeat(64),
    `${'a'.repeat(64)}\n`
  ]) {
    assert.throws(() => parseSyntheticUploadTokenSha256(value), {
      message: 'Invalid OCR configuration'
    })
    assert.throws(
      () =>
        new OcrAuth({
          origin: 'https://ocr.example.test',
          authOrigin: 'https://auth.example.test',
          ownerId: 'synthetic-owner',
          syntheticUploadTokenSha256: value
        }),
      { message: 'Invalid OCR configuration' }
    )
  }
})

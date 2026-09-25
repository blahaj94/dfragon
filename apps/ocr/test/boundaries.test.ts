import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCreatedLogin, parseLoginTokens } from '../src/auth-responses.js'
import { httpFailure, OcrError } from '../src/errors.js'

test('malformed authentication responses are upstream failures', () => {
  for (const response of [
    null,
    [],
    {},
    { accessToken: 'token', accessTokenExpiresAt: 'invalid' }
  ]) {
    assert.throws(() => parseLoginTokens(response), { code: 'AUTH_UNAVAILABLE' })
  }
  assert.throws(
    () =>
      parseCreatedLogin({
        requestId: 'request',
        browserUrl: 'invalid',
        expiresAt: '2026-09-25T00:00:00.000Z'
      }),
    { code: 'AUTH_UNAVAILABLE' }
  )
})

test('HTTP boundary preserves classified errors and distinguishes invalid JSON from internal bugs', () => {
  const classified = new OcrError('LABEL_SPLIT_CHANGE')

  assert.equal(httpFailure(classified), classified)
  assert.equal(httpFailure({ type: 'entity.parse.failed' }).code, 'INVALID_INPUT')
  assert.equal(httpFailure({ type: 'entity.too.large' }).code, 'UPLOAD_TOO_LARGE')
  assert.equal(httpFailure(new SyntaxError('internal detail')).code, 'UNAVAILABLE')
})

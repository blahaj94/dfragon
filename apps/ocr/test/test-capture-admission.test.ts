import assert from 'node:assert/strict'
import test from 'node:test'
import { requireTestCaptureUpload } from '../src/test-capture-admission.js'

const REQUESTS_OVER_PREVIOUS_GLOBAL_LIMIT = 121

test('익명 수집은 이전 IP별 한도와 전체 한도를 넘어도 계속 허용한다', () => {
  const request = { headers: {} }
  for (let attempt = 0; attempt < REQUESTS_OVER_PREVIOUS_GLOBAL_LIMIT; attempt++) {
    assert.doesNotThrow(() => requireTestCaptureUpload(request, true))
  }
})

test('요청량 제한 없이도 비활성 설정과 자격 헤더는 거절한다', () => {
  assert.throws(() => requireTestCaptureUpload({ headers: {} }, false), { code: 'NOT_FOUND' })
  for (const headers of [{ authorization: 'synthetic-token' }, { cookie: 'synthetic=value' }]) {
    assert.throws(() => requireTestCaptureUpload({ headers }, true), { code: 'INVALID_INPUT' })
  }
})

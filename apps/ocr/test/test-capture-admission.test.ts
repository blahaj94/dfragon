import assert from 'node:assert/strict'
import test from 'node:test'
import type { Request } from 'express'
import { TestCaptureAdmission } from '../src/test-capture-admission.js'

function request(ip: string): Request {
  return { ip, headers: {}, socket: { remoteAddress: '127.0.0.1' } } as Request
}

test('익명 IPv6 수집은 같은 /64 예산을 공유하고 한도 창이 지나면 다시 받는다', () => {
  let now = 0
  const admission = new TestCaptureAdmission(true, () => now)
  for (let attempt = 0; attempt < 24; attempt++) {
    admission.require(request(`2001:db8:1:2::${attempt + 1}`))
  }
  assert.throws(() => admission.require(request('2001:db8:1:2::ff')), { code: 'TEST_UPLOAD_LIMIT' })
  admission.require(request('2001:db8:1:3::1'))
  now = 60_000
  admission.require(request('2001:db8:1:2::ff'))
})

test('서로 다른 IP도 익명 수집 전체 한도를 공유한다', () => {
  const admission = new TestCaptureAdmission(true, () => 0)
  for (let attempt = 0; attempt < 120; attempt++) {
    admission.require(request(`192.0.2.${attempt + 1}`))
  }
  assert.throws(() => admission.require(request('198.51.100.1')), { code: 'TEST_UPLOAD_LIMIT' })
})

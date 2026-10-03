import assert from 'node:assert/strict'
import test from 'node:test'
import { parseReturnTarget } from '../browser/return-target.ts'

const callback = 'https://ocr.example.test/auth/callback'

test('웹 복귀 주소는 고정 HTTPS 경계와 code parameter 하나를 요구한다', () => {
  const accepted = callback + '?code=fixture'
  assert.deepEqual(parseReturnTarget(new URL(accepted), callback), { kind: 'web', href: accepted })
  for (const invalid of [
    'http://ocr.example.test/auth/callback?code=fixture',
    'https://other.example.test/auth/callback?code=fixture',
    'https://ocr.example.test/elsewhere?code=fixture',
    'https://user:password@ocr.example.test/auth/callback?code=fixture',
    callback + '?code=fixture#fragment',
    callback,
    callback + '?other=fixture',
    callback + '?code=one&code=two',
    callback + '?code=fixture&other=extra',
    'dfragon://auth/callback?code=fixture'
  ]) {
    assert.throws(() => parseReturnTarget(new URL(invalid), callback), /웹 복귀 주소/)
  }
  // Empty code values were not rejected by this browser boundary; preserve that contract.
  assert.equal(parseReturnTarget(new URL(callback + '?code='), callback).kind, 'web')
})

test('앱 복귀 주소는 두 scheme과 기존 URL 정규화 동작을 유지한다', () => {
  for (const scheme of ['dfragon:', 'dfragon.dev:']) {
    const href = scheme + '//auth/callback?code=fixture'
    for (const webTarget of [undefined, '']) {
      assert.deepEqual(parseReturnTarget(new URL(href), webTarget), { kind: 'app', href })
    }
  }
  for (const href of [
    'https://auth/callback?code=fixture',
    'other://auth/callback?code=fixture',
    'dfragon://other/callback?code=fixture',
    'dfragon://auth/elsewhere?code=fixture',
    'dfragon://auth:123/callback?code=fixture'
  ]) {
    assert.throws(() => parseReturnTarget(new URL(href), undefined), /앱 복귀 주소/)
  }
  const url = new URL('dfragon://auth/callback?code=fixture#retained')
  const before = url.href
  assert.deepEqual(parseReturnTarget(url, undefined), { kind: 'app', href: before })
  assert.equal(url.href, before)
})

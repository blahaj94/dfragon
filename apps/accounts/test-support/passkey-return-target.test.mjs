import assert from 'node:assert/strict'
import test from 'node:test'
import { parseReturnTarget } from '../browser/return-target.ts'

const callback = 'https://ocr.example.test/auth/callback'

test('웹 복귀 주소는 고정 HTTPS 경계와 code parameter 하나를 요구한다', () => {
  const accepted = callback + '?code=fixture'
  assert.deepEqual(parseReturnTarget(accepted, callback), { kind: 'web', href: accepted })
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
    assert.throws(() => parseReturnTarget(invalid, callback), /웹 복귀 주소/)
  }
  // Empty code values were not rejected by this browser boundary; preserve that contract.
  assert.equal(parseReturnTarget(callback + '?code=', callback).kind, 'web')
})

test('앱 복귀 주소는 정규 loopback 주소와 code 하나만 허용한다', () => {
  const code = 'A'.repeat(43)
  for (const port of [1024, 49152, 65535]) {
    const href = `http://127.0.0.1:${port}/auth/callback?code=${code}`
    for (const webTarget of [undefined, '']) {
      assert.deepEqual(parseReturnTarget(href, webTarget), { kind: 'app', href })
    }
  }
  const target = 'http://127.0.0.1:49152/auth/callback'
  for (const href of [
    `https://127.0.0.1:49152/auth/callback?code=${code}`,
    `http://localhost:49152/auth/callback?code=${code}`,
    `http://127.1:49152/auth/callback?code=${code}`,
    `http://2130706433:49152/auth/callback?code=${code}`,
    `http://127.0.0.1:049152/auth/callback?code=${code}`,
    `http://127.0.0.1:1023/auth/callback?code=${code}`,
    `http://127.0.0.1:65536/auth/callback?code=${code}`,
    `http://127.0.0.1/auth/callback?code=${code}`,
    `http://user@127.0.0.1:49152/auth/callback?code=${code}`,
    `http://127.0.0.1:49152/other/../auth/callback?code=${code}`,
    `dfragon://auth/callback?code=${code}`,
    `dfragon.dev://auth/callback?code=${code}`,
    `${target}/extra?code=${code}`,
    `${target}?code=${code}#`,
    `${target}?code=${code}&state=x`,
    `${target}?code=${code}&code=${code}`,
    `${target}?%63ode=${code}`,
    `${target}?code=%41${code.slice(1)}`,
    `${target}?code=${'A'.repeat(42)}B`,
    `${target}?code=${code}=`,
    `${target}?code=`,
    target,
    ` ${target}?code=${code}`,
    `${target}?code=${code}\n`,
    `${target}?code=${'A'.repeat(2048)}`
  ]) {
    assert.throws(() => parseReturnTarget(href, undefined), /앱 복귀 주소/)
  }
})

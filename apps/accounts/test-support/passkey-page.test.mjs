import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createLoginHttpApp } from '../dist/auth/login/http.js'
import { LoginFailure } from '../dist/errors/login.js'
import { LOGIN_ERRORS } from '../dist/constants/login.js'
import { passkeyPage } from '../dist/auth/login/page.js'

test('빌드된 패스키 HTML은 표시 값을 escape하고 같은 origin 자원과 매번 새 CSP nonce를 쓴다', async () => {
  const input = {
    requestId: '"<script>&',
    purpose: 'login',
    webReturnUrl: 'https://ocr.example.test/auth/callback?value="<&\'',
    cookie: '__Host-dfragon-fixture=fixture-browser-secret'
  }
  const first = await passkeyPage(input)
  const second = await passkeyPage(input)
  assert.match(first.html, /data-request-id="&quot;&lt;script&gt;&amp;"/)
  assert.match(
    first.html,
    /data-web-return-url="https:\/\/ocr\.example\.test\/auth\/callback\?value=&quot;&lt;&amp;&#39;"/
  )
  assert.doesNotMatch(first.html, /fixture-browser-secret|__Host-dfragon-fixture/)
  assert.doesNotMatch(first.html, /\{\{\w+\}\}|<style/)
  const nonce = first.html.match(/nonce="([^"]+)"/)[1]
  const directives = Object.fromEntries(
    first.policy.split(';').map((part) => {
      const [name, ...values] = part.trim().split(/\s+/)
      const sources = values.join(' ')

      return [name, sources]
    })
  )
  assert.deepEqual(directives, {
    'default-src': "'none'",
    'script-src': `'nonce-${nonce}'`,
    'style-src': "'self'",
    'img-src': "'self'",
    'connect-src': "'self'",
    'base-uri': "'none'",
    'form-action': "'none'",
    'frame-ancestors': "'none'"
  })
  const scripts = [...first.html.matchAll(/<script\b[^>]*>/gi)]
  assert.equal(scripts.length, 1)
  assert.ok(scripts[0][0].includes(`nonce="${nonce}"`))
  assert.ok(scripts[0][0].includes('src="/auth/passkeys/client.js"'))
  assert.notEqual(first.policy, second.policy)
  assert.match(first.html, /href="\/auth\/passkeys\/client.css"/)
  assert.match(first.html, /href="\/auth\/passkeys\/icon.png"/)
})

test('패스키 HTTP는 브랜드 PNG를 제공하고 제거된 휴대폰 경로는 노출하지 않는다', async () => {
  const expected = await readFile(new URL('../dist/browser/icon.png', import.meta.url))
  const app = await createLoginHttpApp({
    create: async () => {
      throw new Error('not used')
    },
    authorize: async () => {
      throw new Error('not used')
    },
    manage: async () => {
      throw new Error('not used')
    },
    browser: async () => {
      throw new Error('not used')
    },
    exchange: async () => {
      throw new Error('not used')
    }
  })
  try {
    await app.listen(0, '127.0.0.1')
    const address = app.getHttpServer().address()
    assert.ok(address && typeof address !== 'string')
    const response = await fetch(`http://127.0.0.1:${address.port}/auth/passkeys/icon.png`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'image/png')
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected)
    for (const method of ['GET', 'HEAD']) {
      const retired = await fetch(
        `http://127.0.0.1:${address.port}/auth/login/phone?ticket=retired`,
        { method }
      )
      assert.equal(retired.status, 404)
      assert.equal(retired.headers.get('set-cookie'), null)
    }
  } finally {
    await app.close()
  }
})

test('배포 브라우저 bundle은 설치된 React, StyleX 패키지의 고지문을 포함한다', async () => {
  const script = await readFile(new URL('../dist/browser/passkeys.js', import.meta.url), 'utf8')
  const reactLicense = await readFile(
    new URL('./LICENSE', import.meta.resolve('react/package.json')),
    'utf8'
  )
  const stylexLicense = await readFile(
    new URL('../../../packages/licenses/notices/upstream/stylex-LICENSE.txt', import.meta.url),
    'utf8'
  )
  assert.ok(script.includes('/auth/passkeys/icon.png'))
  assert.ok(script.includes(`React, React DOM and Scheduler\n${reactLicense}`))
  assert.ok(script.includes(`StyleX\n${stylexLicense}`))
})

test('브라우저 bundle은 서버 인증 오류 catalog를 포함하지 않는다', async () => {
  const script = await readFile(new URL('../dist/browser/passkeys.js', import.meta.url), 'utf8')
  assert.doesNotMatch(script, /AUTH_INTERNAL_ERROR|AUTH_UNAVAILABLE|LOGIN_EXCHANGE_INVALID/)
})

test('만료 launch 페이지는 새 로그인 안내를 덧붙이고 query의 복귀 주소를 반영하지 않는다', async () => {
  const unused = async () => {
    throw new Error('not used')
  }
  const app = await createLoginHttpApp({
    create: unused,
    authorize: async () => {
      throw new LoginFailure(LOGIN_ERRORS.REQUEST_INVALID)
    },
    manage: unused,
    browser: unused,
    exchange: unused
  })
  try {
    await app.listen(0, '127.0.0.1')
    const response = await fetch(
      `${await app.getUrl()}/auth/login/authorize?ticket=${'A'.repeat(43)}`
    )
    assert.equal(response.status, 400)
    const html = await response.text()
    assert.ok(html.includes('로그인 요청이 유효하지 않습니다. 다시 로그인해 주세요.'))
    assert.ok(html.includes('앱에서 새 로그인을 시작하세요.'))
    const injected = await fetch(
      `${await app.getUrl()}/auth/login/authorize?ticket=${'A'.repeat(43)}&returnUrl=http://127.0.0.1:49152/auth/callback`
    )
    assert.equal(injected.status, 400)
    assert.ok(!(await injected.text()).includes('127.0.0.1:49152'))
  } finally {
    await app.close()
  }
})

test('다른 로그인 오류의 HTML에는 새 로그인 안내를 붙이지 않는다', async () => {
  const unused = async () => {
    throw new Error('not used')
  }
  const app = await createLoginHttpApp({
    create: unused,
    authorize: async () => {
      throw new LoginFailure(LOGIN_ERRORS.INVALID_REQUEST)
    },
    manage: unused,
    browser: unused,
    exchange: unused
  })
  try {
    await app.listen(0, '127.0.0.1')
    const response = await fetch(
      `${await app.getUrl()}/auth/login/authorize?ticket=${'A'.repeat(43)}`
    )
    assert.equal(response.status, 400)
    const html = await response.text()
    assert.ok(html.includes('인증 요청을 확인해 주세요.'))
    assert.ok(!html.includes('앱에서 새 로그인을 시작하세요.'))
  } finally {
    await app.close()
  }
})

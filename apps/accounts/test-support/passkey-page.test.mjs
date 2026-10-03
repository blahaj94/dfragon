import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createLoginHttpApp } from '../dist/auth/login/http.js'
import { passkeyPage } from '../dist/auth/login/page.js'

test('빌드된 패스키 HTML은 표시 값을 escape하고 같은 origin 자원과 매번 새 CSP nonce를 쓴다', async () => {
  const input = {
    requestId: '"<script>&',
    purpose: 'login',
    view: 'phone',
    confirmationCode: '<123456>',
    webReturnUrl: 'https://ocr.example.test/auth/callback?value="<&\'',
    cookie: '__Host-dfragon-fixture=fixture-browser-secret'
  }
  const first = await passkeyPage(input)
  const second = await passkeyPage(input)
  assert.match(first.html, /data-request-id="&quot;&lt;script&gt;&amp;"/)
  assert.match(first.html, /&lt;123456&gt;/)
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
  const scripts = [...first.html.matchAll(/<script\b[^>]*>/g)]
  assert.equal(scripts.length, 1)
  assert.ok(scripts[0][0].includes(`nonce="${nonce}"`))
  assert.ok(scripts[0][0].includes('src="/auth/passkeys/client.js"'))
  assert.notEqual(first.policy, second.policy)
  assert.match(first.html, /href="\/auth\/passkeys\/client.css"/)
  assert.match(first.html, /href="\/auth\/passkeys\/icon.png"/)
})

test('패스키 브라우저는 같은 origin에서 브랜드 PNG를 제공한다', async () => {
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
  } finally {
    await app.close()
  }
})

test('배포 브라우저 bundle은 설치된 QR·React 패키지의 고지문을 포함한다', async () => {
  const script = await readFile(new URL('../dist/browser/passkeys.js', import.meta.url), 'utf8')
  assert.ok(script.includes('/auth/passkeys/icon.png'))
  assert.ok(script.includes('Copyright (c) 2012 Ryan Day'))
  assert.ok(script.includes('Wyatt Baldwin'))
  assert.ok(script.includes('Meta Platforms, Inc. and affiliates.'))
  assert.ok(script.includes('Permission is hereby granted'))
})

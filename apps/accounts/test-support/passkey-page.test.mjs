import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createLoginHttpApp } from '../dist/auth/login/http.js'
import { passkeyPage } from '../dist/auth/login/page.js'

test('built passkey HTML escapes values and uses a fresh CSP nonce with external styles', async () => {
  const input = {
    requestId: '"<script>&',
    purpose: 'login',
    view: 'phone',
    confirmationCode: '<123456>',
    cookie: ''
  }
  const first = await passkeyPage(input)
  const second = await passkeyPage(input)
  assert.match(first.html, /data-request-id="&quot;&lt;script&gt;&amp;"/)
  assert.match(first.html, /&lt;123456&gt;/)
  assert.doesNotMatch(first.html, /\{\{\w+\}\}|<style/)
  const nonce = first.html.match(/nonce="([^"]+)"/)[1]
  assert.ok(first.policy.includes(`script-src 'nonce-${nonce}'`))
  assert.match(first.policy, /img-src 'self';/)
  assert.doesNotMatch(first.policy, /img-src[^;]*(?:data:|https?:|\*)/)
  assert.notEqual(first.policy, second.policy)
  assert.match(first.html, /href="\/auth\/passkeys\/client.css"/)
  assert.match(first.html, /href="\/auth\/passkeys\/icon.png"/)
})

test('passkey browser serves the same-origin brand PNG', async () => {
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

test('browser build carries the installed QR and React package notices in the delivered bundle', async () => {
  const script = await readFile(new URL('../dist/browser/passkeys.js', import.meta.url), 'utf8')
  assert.ok(script.includes('/auth/passkeys/icon.png'))
  assert.ok(script.includes('Copyright (c) 2012 Ryan Day'))
  assert.ok(script.includes('Wyatt Baldwin'))
  assert.ok(script.includes('Meta Platforms, Inc. and affiliates.'))
  assert.ok(script.includes('Permission is hereby granted'))
})

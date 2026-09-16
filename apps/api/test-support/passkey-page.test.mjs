import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
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
  assert.notEqual(first.policy, second.policy)
  assert.match(first.html, /href="\/auth\/passkeys\/client.css"/)
})

test('browser build carries the installed QR package notices in the delivered bundle', async () => {
  const script = await readFile(new URL('../dist/browser/passkeys.js', import.meta.url), 'utf8')
  assert.ok(script.includes('Copyright (c) 2012 Ryan Day'))
  assert.ok(script.includes('Wyatt Baldwin'))
  assert.ok(script.includes('Permission is hereby granted'))
})

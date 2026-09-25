import assert from 'node:assert/strict'
import test from 'node:test'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import tar from 'tar-stream'
import { Readable } from 'node:stream'
import { OcrAuth } from '../src/auth.js'
import { createOcrApp } from '../src/server.js'
import { OcrStore } from '../src/store.js'
import { upload } from './fixtures.js'
const ownerId = randomUUID(),
  origin = 'https://ocr.example.test',
  authOrigin = 'https://auth.example.test'
async function fixture(identity = ownerId, expired = false, revoked = false) {
  const calls: string[] = []
  const request: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname
    calls.push(path)
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    if (path === '/auth/login-requests') {
      assert.equal(body.clientId, 'ocr')
      return Response.json({
        requestId: randomUUID(),
        browserUrl: `${authOrigin}/auth/login/authorize?ticket=synthetic`,
        expiresAt: new Date(Date.now() + 600_000).toISOString()
      })
    }
    if (path === '/auth/exchange') {
      assert.equal(body.clientId, 'ocr')
      assert.equal(body.codeVerifier.length, 43)
      return Response.json({
        accessToken: 'synthetic-access',
        refreshToken: 'synthetic-refresh',
        accessTokenExpiresAt: new Date(Date.now() + (expired ? -1000 : 900_000)).toISOString(),
        user: { id: identity, nickname: '테스트' }
      })
    }
    if (path === '/auth/refresh') {
      await new Promise((resolve) => setTimeout(resolve, 15))
      return Response.json({
        accessToken: 'synthetic-refreshed',
        refreshToken: 'synthetic-rotated',
        accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString()
      })
    }
    if (path === '/me') {
      if (revoked) {
        return new Response(null, { status: 401 })
      }
      return Response.json({ user: { id: identity, nickname: '테스트' } })
    }
    if (path === '/auth/logout') {
      return new Response(null, { status: 204 })
    }
    throw new Error('Unexpected auth request')
  }
  const config = { origin, authOrigin, ownerId },
    store = new OcrStore(':memory:', 1024 * 1024)
  const runtime = await createOcrApp(config, store, new OcrAuth(config, request))
  await runtime.app.listen(0, '127.0.0.1')
  const server = runtime.app.getHttpServer()
  const address = server.address()
  assert(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}`
  async function login() {
    const started = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { Origin: origin }
    })
    const binding = started.headers.get('set-cookie')!.split(';')[0]
    const response = await fetch(`${base}/auth/callback?code=${'A'.repeat(43)}`, {
      headers: { Cookie: binding },
      redirect: 'manual'
    })
    return {
      response,
      cookie: response.headers
        .getSetCookie()
        .find((value) => value.startsWith('__Host-ocr-session='))
        ?.split(';')[0]
    }
  }
  return {
    base,
    store,
    calls,
    login,
    close: async () => {
      await runtime.close()
      store.close()
    }
  }
}
test('Desktop upload requires a live owner bearer and grants no browser or management session', async () => {
  const f = await fixture()
  const headers = {
    Authorization: 'Bearer synthetic.desktop.token',
    'Content-Type': 'application/json'
  }
  try {
    const body = JSON.stringify(upload())
    const send = (extra: Record<string, string>) =>
      fetch(`${f.base}/api/desktop/captures`, { method: 'POST', headers: extra, body })
    assert.equal((await send({ 'Content-Type': 'application/json' })).status, 401)
    assert.equal((await send({ ...headers, Origin: origin })).status, 403)
    const { cookie } = await f.login()
    assert(cookie)
    assert.equal((await send({ Cookie: cookie, 'Content-Type': 'application/json' })).status, 401)
    const response = await send(headers)
    assert.equal(response.status, 201)
    assert.equal(response.headers.get('set-cookie'), null)
    assert.equal((await send(headers)).status, 200)
    assert.equal(f.store.exportManifest().samples[0].text, null)
    assert.equal((await fetch(`${f.base}/api/export`, { headers })).status, 401)
    assert.equal(
      (
        await fetch(`${f.base}/api/splits`, {
          method: 'PUT',
          headers: { ...headers, Origin: origin },
          body: '{}'
        })
      ).status,
      401
    )
    const anonymousLargeBody = await fetch(`${f.base}/api/desktop/captures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'x'.repeat(20_000)
    })
    assert.equal(anonymousLargeBody.status, 401)
  } finally {
    await f.close()
  }
})

test('Desktop upload rejects another account and revoked authentication without writing', async () => {
  for (const [identity, revoked, expected] of [
    [randomUUID(), false, 403],
    [ownerId, true, 401]
  ] as const) {
    const f = await fixture(identity, false, revoked)
    try {
      const response = await fetch(`${f.base}/api/desktop/captures`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer synthetic.desktop.token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(upload())
      })
      assert.equal(response.status, expected)
      assert.equal(f.store.exportManifest().captures.length, 0)
    } finally {
      await f.close()
    }
  }
})

test('owner passkey handoff, CSRF boundary, authenticated images and complete tar export', async () => {
  const f = await fixture()
  try {
    assert.equal((await fetch(`${f.base}/api/stats`)).status, 401)
    assert.equal((await fetch(`${f.base}/auth/login`, { method: 'POST' })).status, 403)
    assert.equal((await fetch(`${f.base}/auth/callback?code=${'A'.repeat(43)}`)).status, 400)
    const { response, cookie } = await f.login()
    assert.equal(response.status, 303)
    assert(cookie)
    assert(
      response.headers
        .getSetCookie()
        .some((value) =>
          ['Secure', 'HttpOnly', 'SameSite=Lax'].every((attribute) => value.includes(attribute))
        )
    )
    const headers = { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }
    const malformed = await fetch(`${f.base}/api/captures`, { method: 'POST', headers, body: '{' })
    assert.equal(malformed.status, 400)
    assert.deepEqual(await malformed.json(), { error: 'INVALID_INPUT' })
    const ordinaryLimit = await fetch(`${f.base}/api/captures`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ text: 'a'.repeat(17 * 1024) })
    })
    assert.equal(ordinaryLimit.status, 413)
    const body = upload()
    const send = () =>
      fetch(`${f.base}/api/captures`, { method: 'POST', headers, body: JSON.stringify(body) })
    assert.equal((await send()).status, 201)
    assert.equal((await send()).status, 200)
    assert.equal((await fetch(`${f.base}/api/captures/${body.id}/image`)).status, 401)
    assert.equal((await fetch(`${f.base}/api/captures/${body.id}/image`, { headers })).status, 200)
    assert.equal(
      (
        await fetch(`${f.base}/api/splits`, {
          method: 'PUT',
          headers: { ...headers, Origin: 'https://attacker.invalid' },
          body: '{}'
        })
      ).status,
      403
    )
    const id = `${body.id}-1`
    assert.equal(
      (
        await fetch(`${f.base}/api/samples/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ text: '테스트닉네임', excluded: false })
        })
      ).status,
      200
    )
    assert.equal(
      (
        await fetch(`${f.base}/api/splits`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ text: '테스트닉네임', split: 'val' })
        })
      ).status,
      200
    )
    const archive = await fetch(`${f.base}/api/export`, { headers })
    assert.equal(archive.status, 200)
    const entries = new Map<string, Buffer>(),
      extract = tar.extract()
    extract.on('entry', (header, stream, next) => {
      const chunks: Buffer[] = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => {
        entries.set(header.name, Buffer.concat(chunks))
        next()
      })
    })
    Readable.from(Buffer.from(await archive.arrayBuffer())).pipe(extract)
    await once(extract, 'finish')
    assert.equal(entries.size, 4)
    const manifest = JSON.parse(entries.get('manifest.json')!.toString())
    assert.equal(manifest.samples.find((s: { id: string }) => s.id === id).split, 'val')
    assert(entries.has(`originals/${body.id}.png`))
    assert(entries.has(`crops/${id}.png`))
    assert.equal((await fetch(`${f.base}/auth/logout`, { method: 'POST', headers })).status, 204)
    assert.equal((await fetch(`${f.base}/api/stats`, { headers })).status, 401)
  } finally {
    await f.close()
  }
})
test('another valid DFRAGON account cannot obtain an OCR session', async () => {
  const f = await fixture(randomUUID())
  try {
    const { response, cookie } = await f.login()
    assert.equal(response.status, 403)
    assert.equal(cookie, undefined)
    assert(f.calls.includes('/auth/logout'))
  } finally {
    await f.close()
  }
})

test('concurrent protected requests share one refresh of the existing authentication session', async () => {
  const f = await fixture(ownerId, true)
  try {
    const { cookie } = await f.login()
    assert(cookie)
    const responses = await Promise.all(
      ['/api/stats', '/api/samples'].map((path) =>
        fetch(`${f.base}${path}`, { headers: { Cookie: cookie } })
      )
    )
    assert.deepEqual(
      responses.map((response) => response.status),
      [200, 200]
    )
    assert.equal(f.calls.filter((path) => path === '/auth/refresh').length, 1)
  } finally {
    await f.close()
  }
})

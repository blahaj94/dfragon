import assert from 'node:assert/strict'
import test from 'node:test'
import { once } from 'node:events'
import { createHash, randomFillSync, randomUUID } from 'node:crypto'
import { PNG } from 'pngjs'
import { request as httpRequest } from 'node:http'
import tar from 'tar-stream'
import { Readable } from 'node:stream'
import { OcrAuth } from '../src/auth.js'
import { createOcrApp } from '../src/server.js'
import { OcrStore } from '../src/store.js'
import { raidUpload, syntheticUpload, upload } from './fixtures.js'
const ownerId = randomUUID(),
  origin = 'https://ocr.example.test',
  authOrigin = 'https://auth.example.test'

const syntheticToken = 'synthetic-upload-token-for-tests-'.repeat(2)
const syntheticTokenSha256 = createHash('sha256').update(syntheticToken).digest('hex')

test('synthetic upload uses only its dedicated token and exports the stored label and image', async () => {
  const f = await fixture(ownerId, false, false, undefined, syntheticTokenSha256)
  const input = syntheticUpload()
  const path = `${f.base}/api/synthetic-samples`
  const bearer = {
    Authorization: `Bearer ${syntheticToken}`,
    'Content-Type': 'application/json'
  }
  try {
    // Missing, incorrect and owner JWT credentials fail before JSON decoding.
    for (const authorization of [
      undefined,
      'Bearer short',
      `Bearer ${'A'.repeat(64)}`,
      'Bearer synthetic.desktop.token'
    ]) {
      const response = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authorization ? { Authorization: authorization } : {})
        },
        body: '{'
      })
      assert.equal(response.status, 401)
      assert.deepEqual(await response.json(), { error: 'UPLOAD_TOKEN_REQUIRED' })
    }
    assert.equal(
      (await fetch(path, { method: 'POST', headers: { ...bearer, Origin: origin }, body: '{' }))
        .status,
      403
    )
    const uploaded = await fetch(path, {
      method: 'POST',
      headers: bearer,
      body: JSON.stringify(input)
    })
    assert.equal(uploaded.status, 201)
    assert.equal(uploaded.headers.get('set-cookie'), null)
    assert.deepEqual(await uploaded.json(), { id: input.id, duplicate: false })
    const retry = await fetch(path, {
      method: 'POST',
      headers: bearer,
      body: JSON.stringify(input)
    })
    assert.equal(retry.status, 200)
    assert.equal((await retry.json()).duplicate, true)
    const changed = await fetch(path, {
      method: 'POST',
      headers: bearer,
      body: JSON.stringify({ ...input, text: '다른고래' })
    })
    assert.equal(changed.status, 409)
    assert.deepEqual(f.calls, [])

    // An upload token cannot read data, edit labels/splits or register captures/models.
    for (const path of [
      '/api/session',
      '/api/stats',
      '/api/samples',
      '/api/export',
      '/api/export/manifest',
      '/api/desktop/dataset',
      '/api/desktop/models',
      `/api/desktop/samples/${input.id}-1/image`
    ]) {
      assert.equal((await fetch(`${f.base}${path}`, { headers: bearer })).status, 401)
    }
    for (const [method, path] of [
      ['POST', '/api/captures'],
      ['POST', '/api/models'],
      ['PATCH', `/api/samples/${input.id}-1`],
      ['PUT', '/api/splits']
    ]) {
      assert.equal(
        (
          await fetch(`${f.base}${path}`, {
            method,
            headers: { ...bearer, Origin: origin },
            body: '{'
          })
        ).status,
        401
      )
    }
    for (const path of ['/api/desktop/captures', '/api/desktop/models']) {
      assert.equal(
        (await fetch(`${f.base}${path}`, { method: 'POST', headers: bearer, body: '{' })).status,
        401
      )
    }
    assert.deepEqual(f.calls, [])
    assert.equal(f.store.stats()?.captures, 1)

    const { cookie } = await f.login()
    assert(cookie)
    const headers = { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }
    const cookieUpload = await fetch(path, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: '{'
    })
    assert.equal(cookieUpload.status, 401)
    assert.equal(
      (await fetch(path, { method: 'POST', headers, body: JSON.stringify(input) })).status,
      403
    )
    // Express route aliases must never fall back to the owner cookie.
    for (const path of [
      '/api/synthetic-samples/',
      '/api/SYNTHETIC-SAMPLES',
      '/API/synthetic-samples',
      '/api/synthetic-samples?extra=1',
      '/api/desktop/synthetic-samples'
    ]) {
      assert.equal(
        (
          await fetch(`${f.base}${path}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(syntheticUpload())
          })
        ).status,
        404
      )
    }
    assert.equal(f.store.stats()?.captures, 1)

    const listed = await fetch(`${f.base}/api/samples?kind=synthetic`, { headers })
    const sample = (await listed.json()).samples[0]
    assert.equal(sample.text, input.text)
    assert.equal(sample.split, 'train')
    assert.equal(sample.kind, 'synthetic')
    const relabeled = await fetch(`${f.base}/api/samples/${sample.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ text: '변경', excluded: false, confirmSplitChange: true })
    })
    assert.equal(relabeled.status, 409)
    const repartitioned = await fetch(`${f.base}/api/splits`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ text: input.text, split: 'test' })
    })
    assert.equal(repartitioned.status, 409)
    const image = await fetch(`${f.base}/api/samples/${sample.id}/image`, { headers })
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), Buffer.from(input.png, 'base64'))
    const exported = await fetch(`${f.base}/api/export/manifest`, { headers })
    const manifest = await exported.json()
    assert.deepEqual(manifest.captures[0].synthetic, {
      text: input.text,
      rendering: input.rendering
    })
    assert.equal(manifest.samples[0].text, input.text)
    const desktop = await fetch(`${f.base}/api/desktop/dataset`, {
      headers: { Authorization: 'Bearer synthetic.desktop.token' }
    })
    assert.deepEqual((await desktop.json()).samples, [])
  } finally {
    await f.close()
  }
})

test('synthetic upload is disabled without configuration and rotates independently of owner sessions', async () => {
  const rotatedToken = 'rotated-upload-token-for-tests-'.repeat(2)
  const rotatedSha256 = createHash('sha256').update(rotatedToken).digest('hex')
  for (const [digest, token, expected] of [
    [undefined, syntheticToken, 401],
    [rotatedSha256, syntheticToken, 401],
    [rotatedSha256, rotatedToken, 201]
  ] as const) {
    // The upstream owner session is revoked; dedicated upload authentication does not use it.
    const f = await fixture(ownerId, false, true, undefined, digest)
    try {
      const response = await fetch(`${f.base}/api/synthetic-samples`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: expected === 201 ? JSON.stringify(syntheticUpload()) : '{'
      })
      assert.equal(response.status, expected)
      assert.deepEqual(f.calls, [])
      assert.equal(f.store.stats()?.captures, expected === 201 ? 1 : 0)
    } finally {
      await f.close()
    }
  }
})

test('authenticated synthetic PNG uploads share the large JSON parser', async () => {
  const f = await fixture(ownerId, false, false, undefined, syntheticTokenSha256)
  try {
    const image = new PNG({ width: 128, height: 128 })
    randomFillSync(image.data)
    for (let i = 3; i < image.data.length; i += 4) {
      image.data[i] = 255
    }
    const input = { ...syntheticUpload(), png: PNG.sync.write(image).toString('base64') }
    const body = JSON.stringify(input)
    assert(body.length > 16 * 1024)
    const response = await fetch(`${f.base}/api/synthetic-samples`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${syntheticToken}`, 'Content-Type': 'application/json' },
      body
    })
    assert.equal(response.status, 201)
    assert.equal(f.store.stats()?.captures, 1)
    assert.deepEqual(f.calls, [])
  } finally {
    await f.close()
  }
})

test('model REST API authenticates before multipart parsing and preserves uploaded files', async () => {
  const f = await fixture()
  const id = randomUUID()
  const makeBody = () => {
    const body = new FormData()
    body.set(
      'metadata',
      JSON.stringify({
        id,
        name: '합성 모델',
        preset: 'korean-ppocrv5',
        kind: 'pretrained',
        parentId: null
      })
    )
    body.append('files', new Blob(['synthetic weights']), 'weights.pdparams')
    body.append('files', new Blob(['가\n나\n']), 'characters.txt')

    return body
  }
  try {
    assert.equal((await fetch(`${f.base}/api/desktop/models`)).status, 401)
    assert.equal(
      (
        await fetch(`${f.base}/api/models`, {
          method: 'POST',
          headers: { Origin: origin },
          body: makeBody()
        })
      ).status,
      401
    )
    const { cookie } = await f.login()
    assert(cookie)
    assert.equal(
      (
        await fetch(`${f.base}/api/models`, {
          method: 'POST',
          headers: { Cookie: cookie },
          body: makeBody()
        })
      ).status,
      403
    )
    const encoded = new Request(`${f.base}/api/models`, { method: 'POST', body: makeBody() })
    const bytes = Buffer.from(await encoded.arrayBuffer())
    // Keep the multipart body incomplete beyond the old 30-second request deadline.
    const uploaded = await new Promise<{ status: number | undefined; body: Buffer }>(
      (resolve, reject) => {
        const request = httpRequest(
          encoded.url,
          {
            method: 'POST',
            headers: {
              Cookie: cookie,
              Origin: origin,
              'Content-Type': encoded.headers.get('content-type')!,
              'Content-Length': bytes.length
            }
          },
          (response) => {
            const chunks: Buffer[] = []
            response.on('data', (chunk: Buffer) => chunks.push(chunk))
            response.on('error', reject)
            response.on('end', () =>
              resolve({ status: response.statusCode, body: Buffer.concat(chunks) })
            )
          }
        )
        request.on('error', reject)
        request.write(bytes.subarray(0, -1))
        const finish = setTimeout(() => request.end(bytes.subarray(-1)), 31_000)
        request.once('close', () => clearTimeout(finish))
      }
    )
    assert.equal(uploaded.status, 201)
    assert.equal(JSON.parse(uploaded.body.toString()).model.id, id)
    const headers = { Authorization: 'Bearer synthetic.desktop.token' }
    const listed = await fetch(`${f.base}/api/desktop/models`, { headers })
    assert.equal(listed.status, 200)
    assert.equal((await listed.json()).models[0].id, id)
    const file = await fetch(`${f.base}/api/desktop/models/${id}/files/weights.pdparams`, {
      headers
    })
    assert.equal(await file.text(), 'synthetic weights')
    assert.equal(
      (await fetch(`${f.base}/api/desktop/models`, { headers: { ...headers, Origin: origin } }))
        .status,
      403
    )
    const retry = await fetch(`${f.base}/api/desktop/models`, {
      method: 'POST',
      headers,
      body: makeBody()
    })
    assert.equal((await retry.json()).duplicate, true)
    const childId = randomUUID()
    const child = makeBody()
    child.set(
      'metadata',
      JSON.stringify({
        id: childId,
        name: '학습 결과',
        preset: 'korean-ppocrv5',
        kind: 'finetuned',
        parentId: id
      })
    )
    child.append(
      'files',
      new Blob(['{"schemaVersion":1,"summary":{"cer":0.1}}']),
      'evaluation.json'
    )
    const trained = await fetch(`${f.base}/api/models`, {
      method: 'POST',
      headers: { Cookie: cookie, Origin: origin },
      body: child
    })
    assert.equal(trained.status, 201)
    assert.equal((await trained.json()).model.parentId, id)
    const evaluation = await fetch(
      `${f.base}/api/desktop/models/${childId}/files/evaluation.json`,
      { headers }
    )
    assert.deepEqual(await evaluation.json(), { schemaVersion: 1, summary: { cer: 0.1 } })
    assert.equal(
      (await fetch(`${f.base}/api/models/${id}/files/weights.pdparams`, { headers })).status,
      401
    )
  } finally {
    await f.close()
  }
})
async function fixture(
  identity = ownerId,
  expired = false,
  revoked = false,
  trustedProxyHops?: 1,
  syntheticUploadTokenSha256?: string
) {
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
  const config = { origin, authOrigin, ownerId, trustedProxyHops, syntheticUploadTokenSha256 },
    store = new OcrStore(':memory:', 1024 * 1024)
  const runtime = await createOcrApp(config, store, new OcrAuth(config, request))
  // Check deadlines promptly so the slow multipart case catches the old 30-second cutoff.
  Object.assign(runtime.app.getHttpServer(), { connectionsCheckingInterval: 100 })
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
    const cookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith('__Host-ocr-session='))
      ?.split(';')[0]

    return { response, cookie }
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

test('OCR login ignores spoofed forwarded IPs by default and isolates clients only with explicit proxy trust', async () => {
  for (const trustedProxyHops of [undefined, 1] as const) {
    const f = await fixture(ownerId, false, false, trustedProxyHops)
    try {
      for (let index = 0; index < 4; index++) {
        const response = await fetch(`${f.base}/auth/login`, {
          method: 'POST',
          headers: { Origin: origin, 'X-Forwarded-For': `192.0.2.${index + 1}` }
        })
        assert.equal(response.status, index < 3 || trustedProxyHops === 1 ? 200 : 429)
        await response.arrayBuffer()
      }
      assert.equal(f.calls.length, trustedProxyHops === 1 ? 4 : 3)
    } finally {
      await f.close()
    }
  }
})

test('malicious sparse multipart fields are rejected without stopping the OCR server or storing a model', async () => {
  const f = await fixture()
  try {
    for (const names of [
      ['field[4294967294]', 'field[]'],
      ['field[4294967295]', 'field[x]']
    ]) {
      const body = new FormData()
      for (const name of names) {
        body.append(name, 'synthetic')
      }
      const response = await fetch(`${f.base}/api/desktop/models`, {
        method: 'POST',
        headers: { Authorization: 'Bearer synthetic.desktop.token' },
        body
      })
      assert.equal(response.status, 400)
      await response.arrayBuffer()
      assert.equal((await fetch(`${f.base}/health`)).status, 200)
      assert.equal(f.store.models().length, 0)
    }
  } finally {
    await f.close()
  }
})
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

test('Desktop upload policy rejects aliases and invalid credentials before parsing JSON', async () => {
  const f = await fixture()
  try {
    for (const authorization of ['', 'Basic synthetic', 'Bearer malformed']) {
      const response = await fetch(`${f.base}/api/desktop/captures`, {
        method: 'POST',
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: '{'
      })
      assert.equal(response.status, 401)
    }
    for (const [method, path] of [
      ['POST', '/api/desktop/captures?extra=1'],
      ['POST', '/api/desktop/captures/'],
      ['PUT', '/api/desktop/captures']
    ]) {
      for (const [headers, expected] of [
        [{}, 403],
        [{ Origin: origin }, 401]
      ] as const) {
        const response = await fetch(`${f.base}${path}`, {
          method,
          headers: {
            ...headers,
            Authorization: 'Bearer synthetic.desktop.token',
            'Content-Type': 'application/json'
          },
          body: '{'
        })
        assert.equal(response.status, expected)
      }
    }
    assert.deepEqual(f.calls, [])
    assert.equal(f.store.exportManifest().captures.length, 0)
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

test('Desktop dataset exposes owner labels, exclusions, splits and exact crops without write access', async () => {
  const f = await fixture()
  const headers = { Authorization: 'Bearer synthetic.desktop.token' }
  try {
    const data = upload()
    await fetch(`${f.base}/api/desktop/captures`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const id = `${data.id}-1`
    f.store.updateSample(id, { text: '평가용', excluded: false, confirmSplitChange: false })
    f.store.assign('평가용', 'test')
    f.store.updateSample(`${data.id}-3`, { text: null, excluded: true, confirmSplitChange: false })
    const response = await fetch(`${f.base}/api/desktop/dataset`, { headers })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('set-cookie'), null)
    const dataset = await response.json()
    assert.equal(dataset.samples.length, 2)
    assert.equal(dataset.samples[0].text, '평가용')
    assert.equal(dataset.samples[0].split, 'test')
    assert.equal(dataset.samples[1].excluded, true)
    assert.equal(dataset.samples[1].text, null)
    const image = await fetch(`${f.base}/api/desktop/samples/${id}/image`, { headers })
    assert.equal(image.status, 200)
    const { cookie } = await f.login()
    const browserImage = await fetch(`${f.base}/api/samples/${id}/image`, {
      headers: { Cookie: cookie! }
    })
    assert.deepEqual(
      Buffer.from(await image.arrayBuffer()),
      Buffer.from(await browserImage.arrayBuffer())
    )
    for (const path of ['/api/desktop/dataset', `/api/desktop/samples/${id}/image`]) {
      assert.equal((await fetch(`${f.base}${path}`)).status, 401)
      assert.equal((await fetch(`${f.base}${path}`, { headers: { Cookie: cookie! } })).status, 401)
      assert.equal(
        (await fetch(`${f.base}${path}`, { headers: { ...headers, Origin: origin } })).status,
        403
      )
      for (const suffix of ['/', '?extra=1']) {
        assert.equal((await fetch(`${f.base}${path}${suffix}`, { headers })).status, 401)
      }
      assert.equal((await fetch(`${f.base}${path}`, { method: 'HEAD', headers })).status, 401)
    }
    assert.equal(
      (
        await fetch(`${f.base}/api/samples/${id}`, {
          method: 'PATCH',
          headers: { ...headers, Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: '변경', excluded: false })
        })
      ).status,
      401
    )
    assert.equal(f.store.sample(id).text, '평가용')
  } finally {
    await f.close()
  }
})

test('Desktop reads reject non-owner and revoked sessions before returning data', async () => {
  for (const [identity, revoked, status] of [
    [randomUUID(), false, 403],
    [ownerId, true, 401]
  ] as const) {
    const f = await fixture(identity, false, revoked)
    try {
      for (const path of [
        '/api/desktop/dataset',
        ...[1, 10, 11, 12].map((slot) => `/api/desktop/samples/${randomUUID()}-${slot}/image`)
      ]) {
        assert.equal(
          (
            await fetch(`${f.base}${path}`, {
              headers: { Authorization: 'Bearer synthetic.desktop.token' }
            })
          ).status,
          status
        )
      }
    } finally {
      await f.close()
    }
  }
})

test('raid uploads reject out-of-range and duplicate slots without partial captures', async () => {
  const f = await fixture()
  const headers = {
    Authorization: 'Bearer synthetic.desktop.token',
    'Content-Type': 'application/json'
  }
  try {
    const data = raidUpload()
    for (const invalid of [
      { ...data, crops: [...data.crops, { ...data.crops[0], slot: 13 }] },
      { ...data, crops: [{ ...data.crops[0], slot: 13 }] },
      { ...data, crops: [data.crops[11], data.crops[11]] },
      { ...data, kind: 'hud', crops: data.crops.slice(0, 5) },
      { ...data, kind: 'participants', crops: [data.crops[4]] }
    ]) {
      const response = await fetch(`${f.base}/api/desktop/captures`, {
        method: 'POST',
        headers,
        body: JSON.stringify(invalid)
      })
      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), { error: 'INVALID_INPUT' })
      assert.equal(f.store.stats()?.captures, 0)
      assert.equal(f.store.stats()?.samples, 0)
    }
    const send = () =>
      fetch(`${f.base}/api/desktop/captures`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      })
    assert.equal((await send()).status, 201)
    assert.equal((await send()).status, 200)
    assert.equal(f.store.stats()?.captures, 1)
    assert.equal(f.store.stats()?.samples, 12)
  } finally {
    await f.close()
  }
})

test('raid rows 10 through 12 use the protected dataset, browser labeling, filters and full export', async () => {
  const f = await fixture()
  const desktopHeaders = { Authorization: 'Bearer synthetic.desktop.token' }
  try {
    const data = raidUpload()
    const { cookie } = await f.login()
    assert(cookie)
    const browserHeaders = { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }
    const uploaded = await fetch(`${f.base}/api/captures`, {
      method: 'POST',
      headers: browserHeaders,
      body: JSON.stringify(data)
    })
    assert.equal(uploaded.status, 201)
    const lastId = `${data.id}-12`
    const labeled = await fetch(`${f.base}/api/samples/${lastId}`, {
      method: 'PATCH',
      headers: browserHeaders,
      body: JSON.stringify({ text: '열두번째샘플', excluded: false })
    })
    assert.equal(labeled.status, 200)
    const filtered = await fetch(`${f.base}/api/samples?kind=raid`, { headers: browserHeaders })
    assert.equal(filtered.status, 200)
    assert.deepEqual(
      (await filtered.json()).samples.map((sample: { slot: number }) => sample.slot),
      Array.from({ length: 12 }, (_, i) => i + 1)
    )
    assert.equal(
      (await fetch(`${f.base}/api/samples?kind=raid-other`, { headers: browserHeaders })).status,
      400
    )
    const previousKind = await fetch(`${f.base}/api/samples?kind=participants`, {
      headers: browserHeaders
    })
    assert.deepEqual((await previousKind.json()).samples, [])

    const response = await fetch(`${f.base}/api/desktop/dataset`, { headers: desktopHeaders })
    assert.equal(response.status, 200)
    const dataset = await response.json()
    assert.equal(dataset.samples.length, 12)
    assert(dataset.samples.every((sample: { kind: string }) => sample.kind === 'raid'))
    assert.equal(dataset.samples[11].id, lastId)
    assert.equal(dataset.samples[11].text, '열두번째샘플')
    for (const slot of [10, 11, 12]) {
      const path = `/api/desktop/samples/${data.id}-${slot}/image`
      const image = await fetch(`${f.base}${path}`, { headers: desktopHeaders })
      assert.equal(image.status, 200)
      assert.equal(image.headers.get('set-cookie'), null)
      const browserImage = await fetch(`${f.base}/api/samples/${data.id}-${slot}/image`, {
        headers: browserHeaders
      })
      assert.deepEqual(
        Buffer.from(await image.arrayBuffer()),
        Buffer.from(await browserImage.arrayBuffer())
      )
      assert.equal((await fetch(`${f.base}${path}`)).status, 401)
      assert.equal((await fetch(`${f.base}${path}`, { headers: { Cookie: cookie } })).status, 401)
      assert.equal(
        (await fetch(`${f.base}${path}`, { headers: { ...desktopHeaders, Origin: origin } }))
          .status,
        403
      )
      for (const suffix of ['/', '?extra=1']) {
        assert.equal(
          (await fetch(`${f.base}${path}${suffix}`, { headers: desktopHeaders })).status,
          401
        )
      }
      assert.equal(
        (await fetch(`${f.base}${path}`, { method: 'HEAD', headers: desktopHeaders })).status,
        401
      )
    }
    assert.equal(
      (
        await fetch(`${f.base}/api/desktop/samples/${data.id}-13/image`, {
          headers: desktopHeaders
        })
      ).status,
      401
    )
    assert.equal((await fetch(`${f.base}/api/export`, { headers: desktopHeaders })).status, 401)

    const archive = await fetch(`${f.base}/api/export`, { headers: browserHeaders })
    const entries = new Map<string, Buffer>()
    const extract = tar.extract()
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
    assert.equal(entries.size, 14)
    for (const slot of [10, 11, 12]) {
      assert(entries.has(`crops/${data.id}-${slot}.png`))
    }
    const manifest = JSON.parse(entries.get('manifest.json')!.toString())
    assert.equal(manifest.captures[0].kind, 'raid')
    assert.equal(manifest.samples[11].text, '열두번째샘플')
  } finally {
    await f.close()
  }
})

test('automatic split preview and apply require owner cookie and Origin; stale previews cannot mutate assignments', async () => {
  const f = await fixture()
  try {
    const { cookie } = await f.login()
    const headers = { Cookie: cookie!, Origin: origin, 'Content-Type': 'application/json' }
    const data = upload()
    await fetch(`${f.base}/api/captures`, { method: 'POST', headers, body: JSON.stringify(data) })
    const save = (text: string) =>
      fetch(`${f.base}/api/samples/${data.id}-1`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ text, excluded: false })
      })
    await save('검사★龍')
    const body = { ratios: { train: 70, val: 15, test: 15 }, replaceExisting: false }
    for (const path of ['preview', 'apply']) {
      assert.equal(
        (
          await fetch(`${f.base}/api/splits/${path}`, {
            method: 'POST',
            headers: {
              Origin: origin,
              'Content-Type': 'application/json',
              Authorization: 'Bearer synthetic.desktop.token'
            },
            body: JSON.stringify(body)
          })
        ).status,
        401
      )
      assert.equal(
        (
          await fetch(`${f.base}/api/splits/${path}`, {
            method: 'POST',
            headers: { Cookie: cookie!, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
        ).status,
        403
      )
    }
    const previewResponse = await fetch(`${f.base}/api/splits/preview`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    assert.equal(previewResponse.status, 200)
    const preview = await previewResponse.json()
    assert.equal(preview.before.total.characters, 4)
    const apply = (fingerprint: string) =>
      fetch(`${f.base}/api/splits/apply`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...body, fingerprint })
      })
    await save('다른★龍')
    assert.equal((await apply(preview.fingerprint)).status, 409)
    const fresh = await (
      await fetch(`${f.base}/api/splits/preview`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })
    ).json()
    assert.equal((await apply(fresh.fingerprint)).status, 200)
    assert.equal(
      (await (await fetch(`${f.base}/api/splits/statistics`, { headers })).json()).initialized,
      true
    )
  } finally {
    await f.close()
  }
})

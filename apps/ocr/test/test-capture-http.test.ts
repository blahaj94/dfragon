import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { request as httpRequest, type ClientRequest, type IncomingMessage } from 'node:http'
import test from 'node:test'
import { PNG } from 'pngjs'
import { OcrAuth } from '../src/auth.js'
import { createOcrApp } from '../src/server.js'
import { OcrStore } from '../src/store.js'
import { TEST_CAPTURE_PATH } from '../src/test-capture.js'
import { testCapture, upload } from './fixtures.js'

async function fixture(enabled = true) {
  const config = {
    origin: 'https://ocr.example.test',
    authOrigin: 'https://auth.example.test',
    ownerId: randomUUID(),
    testUploadEnabled: enabled
  }
  const calls: string[] = []
  const auth = new OcrAuth(config, async (input) => {
    const path = new URL(String(input)).pathname
    calls.push(path)
    if (path === '/auth/login-requests') {
      return Response.json({
        requestId: randomUUID(),
        browserUrl: `${config.authOrigin}/auth/login/authorize?ticket=test`,
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      })
    }

    if (path === '/auth/exchange') {
      return Response.json({
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        accessTokenExpiresAt: new Date(Date.now() + 600_000).toISOString(),
        user: { id: config.ownerId, nickname: '검증' }
      })
    }

    if (path === '/me') {
      return Response.json({ user: { id: config.ownerId, nickname: '검증' } })
    }

    if (path === '/auth/logout') {
      return new Response(null, { status: 204 })
    }
    throw new Error('Unexpected test auth request')
  })
  const store = new OcrStore(':memory:', 1024 * 1024)
  const runtime = await createOcrApp(config, store, auth)
  await runtime.app.listen(0, '127.0.0.1')
  const server = runtime.app.getHttpServer()
  const address = server.address()
  assert(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}`
  const send = (body: unknown, headers = {}, path = TEST_CAPTURE_PATH) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    })
  async function login() {
    const start = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { Origin: config.origin }
    })
    const binding = start.headers.get('set-cookie')!.split(';')[0]
    const response = await fetch(`${base}/auth/callback?code=${'A'.repeat(43)}`, {
      headers: { Cookie: binding },
      redirect: 'manual'
    })
    const cookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith('__Host-ocr-session='))!
      .split(';')[0]

    return cookie
  }
  async function close() {
    await runtime.close()
    store.close()
  }

  return { config, base, server, calls, store, send, login, close }
}

test('익명 테스트 수집은 기본 비활성이고 잘못된 본문보다 먼저 거절한다', async (t) => {
  const f = await fixture(false)
  t.after(f.close)
  const response = await fetch(`${f.base}${TEST_CAPTURE_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{'
  })
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: 'NOT_FOUND' })
  assert.deepEqual(f.calls, [])
  assert.equal(f.store.stats()?.captures, 0)
})

test('익명 등록은 조회나 관리 권한을 열지 않고 owner는 닉네임과 전체 슬롯을 구별해 읽는다', async (t) => {
  const f = await fixture()
  t.after(f.close)
  const source = testCapture()
  const uploaded = await f.send(source)
  assert.equal(uploaded.status, 201)
  assert.deepEqual(await uploaded.json(), { id: source.id, duplicate: false })
  assert.equal(uploaded.headers.get('set-cookie'), null)
  assert.deepEqual(f.calls, [])
  for (const path of [
    '/api/session',
    '/api/samples',
    '/api/export/manifest',
    `/api/captures/${source.id}/image`,
    `/api/samples/${source.id}-1/context/image`,
    '/api/desktop/dataset'
  ]) {
    const response = await fetch(`${f.base}${path}`)
    assert.equal(response.status, 401, path)
    await response.arrayBuffer()
  }
  for (const path of [
    `${TEST_CAPTURE_PATH}/`,
    `${TEST_CAPTURE_PATH}?unexpected=1`,
    '/api/desktop/Test-captures'
  ]) {
    const response = await f.send(source, {}, path)
    assert.notEqual(response.status, 201)
    await response.arrayBuffer()
  }
  for (const headers of [
    { Origin: f.config.origin },
    { Authorization: 'Bearer synthetic.desktop.token' },
    { Cookie: 'test=value' }
  ]) {
    const response = await f.send(source, headers)
    assert.equal(response.status, Object.hasOwn(headers, 'Origin') ? 403 : 400)
    await response.arrayBuffer()
  }
  assert.equal(f.store.stats()?.captures, 1)
  assert.deepEqual(f.calls, [])
  const cookie = await f.login()
  const headers = { Cookie: cookie }
  const sample = await fetch(`${f.base}/api/samples`, { headers }).then((response) =>
    response.json()
  )
  assert.equal(sample.samples[0].text, null)
  assert.equal(sample.samples[0].split, 'unassigned')
  assert.equal(sample.samples[0].testCollection.prediction, '잘못된예측')
  const readPng = async (path: string) => {
    const response = await fetch(`${f.base}${path}`, { headers })
    assert.equal(response.status, 200)

    return PNG.sync.read(Buffer.from(await response.arrayBuffer()))
  }
  const nickname = await readPng(`/api/samples/${source.id}-1/image`)
  const context = await readPng(`/api/samples/${source.id}-1/context/image`)
  assert.deepEqual([nickname.width, nickname.height], [3, 2])
  assert.deepEqual([context.width, context.height], [4, 4])
  const original = PNG.sync.read(Buffer.from(source.originalPng, 'base64'))
  assert.deepEqual(context.data.subarray(0, 4), original.data.subarray(0, 4))
  const exported = await fetch(`${f.base}/api/export/manifest`, { headers }).then((response) =>
    response.json()
  )
  assert.deepEqual(
    exported.samples.map((sample: { text: string | null; split: string }) => ({
      text: sample.text,
      split: sample.split
    })),
    [
      { text: null, split: 'unassigned' },
      { text: null, split: 'unassigned' }
    ]
  )
})

test('익명 수집 한 개가 본문을 기다려도 owner 업로드 슬롯은 남고 취소 후 반환된다', async (t) => {
  const f = await fixture()
  const clients: ClientRequest[] = []
  t.after(async () => {
    clients.forEach((client) => client.destroy())
    await f.close()
  })
  const incoming = once(f.server, 'request') as Promise<[IncomingMessage]>
  const client = httpRequest(`${f.base}${TEST_CAPTURE_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  clients.push(client)
  client.on('error', () => {})
  client.flushHeaders()
  const [request] = await incoming
  const receiving = once(request, 'data')
  client.write('{')
  await receiving
  const busy = await f.send(testCapture())
  assert.equal(busy.status, 429)
  assert.deepEqual(await busy.json(), { error: 'UPLOAD_BUSY' })
  const owner = await f.send(
    upload(),
    { Authorization: 'Bearer synthetic.desktop.token' },
    '/api/desktop/captures'
  )
  assert.equal(owner.status, 201)
  await owner.arrayBuffer()
  const closed = new Promise<void>((resolve) => request.socket.once('close', () => resolve()))
  client.destroy()
  await closed
  const accepted = await f.send(testCapture())
  assert.equal(accepted.status, 201)
  await accepted.arrayBuffer()
})

test('JSON 파싱 실패도 익명 IP 한도를 소비하고 초과 요청은 본문 전에 거절한다', async (t) => {
  const f = await fixture()
  t.after(f.close)
  for (let attempt = 0; attempt < 24; attempt++) {
    const response = await fetch(`${f.base}${TEST_CAPTURE_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{'
    })
    assert.equal(response.status, 400)
    await response.arrayBuffer()
  }
  const limited = await f.send(testCapture())
  assert.equal(limited.status, 429)
  assert.deepEqual(await limited.json(), { error: 'TEST_UPLOAD_LIMIT' })
  assert.equal(f.store.stats()?.captures, 0)
  assert.deepEqual(f.calls, [])
})

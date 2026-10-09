import assert from 'node:assert/strict'
import test from 'node:test'
import { once } from 'node:events'
import { request as httpRequest, type ClientRequest, type IncomingMessage } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { OcrAuth } from '../src/auth.js'
import { createOcrApp } from '../src/server.js'
import { OcrStore } from '../src/store.js'
import { syntheticUpload, upload } from './fixtures.js'

function gate() {
  let resolve!: () => void
  const promise = new Promise<void>((release) => {
    resolve = release
  })

  return { promise, resolve }
}

test('인증 중 끊긴 연결은 업로드 슬롯을 차지하지 않고 완료, 실패, 취소는 슬롯을 한 번 반환한다', async (t) => {
  const config = {
    origin: 'https://ocr.example.test',
    authOrigin: 'https://auth.example.test',
    ownerId: randomUUID()
  }
  let authenticationGate: ReturnType<typeof gate> | undefined
  let authenticationStarted = gate()
  const auth = new OcrAuth(config, async () => {
    authenticationStarted.resolve()
    await authenticationGate?.promise

    return Response.json({ user: { id: config.ownerId, nickname: '검증' } })
  })
  const store = new OcrStore(':memory:', 1024 * 1024)
  const runtime = await createOcrApp(config, store, auth)
  await runtime.app.listen(0, '127.0.0.1')
  const server = runtime.app.getHttpServer()
  const address = server.address()
  assert(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}`
  const clients: ClientRequest[] = []
  t.after(async () => {
    authenticationGate?.resolve()
    for (const client of clients) {
      client.destroy()
    }
    await runtime.close()
    store.close()
  })
  const headers = {
    Authorization: 'Bearer synthetic.desktop.token',
    'Content-Type': 'application/json'
  }
  const openUpload = async (path: string, contentType = 'application/json') => {
    const incoming = once(server, 'request') as Promise<[IncomingMessage]>
    const client = httpRequest(`${base}${path}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': contentType }
    })
    client.on('error', () => {})
    clients.push(client)
    client.flushHeaders()
    const [request] = await incoming

    return { client, request }
  }
  const cancel = async ({ client, request }: Awaited<ReturnType<typeof openUpload>>) => {
    const closed = new Promise<void>((resolve) => request.socket.once('close', () => resolve()))
    client.destroy()
    await closed
  }

  for (const path of ['/api/desktop/captures', '/api/desktop/models']) {
    authenticationGate = gate()
    authenticationStarted = gate()
    const canceled = await openUpload(path)
    await authenticationStarted.promise
    await cancel(canceled)
    // 인증 응답을 풀기 전에 서버가 연결 종료를 관찰했는지 확인한다.
    authenticationGate.resolve()
    authenticationGate = undefined

    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers,
      body: path.endsWith('captures') ? JSON.stringify(upload()) : '{}'
    })
    assert.equal(response.status, path.endsWith('captures') ? 201 : 400)
    await response.arrayBuffer()
  }

  for (let round = 0; round < 2; round++) {
    const first = await openUpload('/api/desktop/captures')
    const second = await openUpload('/api/desktop/captures')
    const busy = await fetch(`${base}/api/desktop/captures`, {
      method: 'POST',
      headers,
      body: JSON.stringify(upload()),
      signal: AbortSignal.timeout(2000)
    })
    assert.equal(busy.status, 429)
    assert.deepEqual(await busy.json(), { error: 'UPLOAD_BUSY' })
    const completed = new Promise<number | undefined>((resolve) => {
      first.client.once('response', (response) => {
        response.resume()
        response.once('end', () => resolve(response.statusCode))
      })
    })
    first.client.end(round === 0 ? JSON.stringify(upload()) : '{')
    assert.equal(await completed, round === 0 ? 201 : 400)
    await cancel(second)
  }
})

test('실제, 합성 업로드는 두 슬롯을 공유하고 본문 실패, 연결 취소 뒤 같은 내용을 재시도한다', async (t) => {
  const token = 'fixture-synthetic-upload-token-for-boundary-tests-'.repeat(2)
  const config = {
    origin: 'https://ocr.example.test',
    authOrigin: 'https://auth.example.test',
    ownerId: randomUUID(),
    syntheticUploadTokenSha256: createHash('sha256').update(token).digest('hex')
  }
  const auth = new OcrAuth(config, async (input, init) => {
    assert.equal(new URL(String(input)).pathname, '/me')
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer synthetic.desktop.token')

    return Response.json({ user: { id: config.ownerId, nickname: '검증' } })
  })
  const store = new OcrStore(':memory:', 1024 * 1024)
  const runtime = await createOcrApp(config, store, auth)
  await runtime.app.listen(0, '127.0.0.1')
  const server = runtime.app.getHttpServer()
  const address = server.address()
  assert(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}`
  const clients: ClientRequest[] = []
  t.after(async () => {
    for (const client of clients) {
      client.destroy()
    }
    await runtime.close()
    store.close()
  })
  const open = async (path: string, authorization: string) => {
    const incoming = once(server, 'request') as Promise<[IncomingMessage]>
    const client = httpRequest(`${base}${path}`, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' }
    })
    client.on('error', () => {})
    clients.push(client)
    client.flushHeaders()
    const [request] = await incoming
    const consumed = once(request, 'data')
    client.write('{')
    // 본문 첫 chunk의 소비로 인증 및 parser 진입을 확인하고 두 요청을 열린 상태로 둔다.
    await consumed

    return { client, request }
  }
  const desktop = await open('/api/desktop/captures', 'Bearer synthetic.desktop.token')
  const synthetic = await open('/api/synthetic-samples', `Bearer ${token}`)
  const source = upload()
  const generated = syntheticUpload()
  const send = (path: string, authorization: string, value: unknown) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify(value)
    })
  for (const [path, authorization, value] of [
    ['/api/desktop/captures', 'Bearer synthetic.desktop.token', source],
    ['/api/synthetic-samples', `Bearer ${token}`, generated]
  ] as const) {
    const busy = await send(path, authorization, value)
    assert.equal(busy.status, 429)
    assert.deepEqual(await busy.json(), { error: 'UPLOAD_BUSY' })
  }
  assert.equal(store.stats()?.captures, 0)
  assert.equal(store.stats()?.samples, 0)
  const failed = once(desktop.client, 'response') as Promise<[IncomingMessage]>
  desktop.client.end('}')
  const [response] = await failed
  const chunks: Buffer[] = []
  response.on('data', (chunk: Buffer) => chunks.push(chunk))
  await once(response, 'end')
  assert.equal(response.statusCode, 400)
  assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()), { error: 'INVALID_INPUT' })
  const closed = new Promise<void>((resolve) => {
    synthetic.request.socket.once('close', () => resolve())
  })
  synthetic.client.destroy()
  await closed
  const retried = await Promise.all([
    send('/api/desktop/captures', 'Bearer synthetic.desktop.token', source),
    send('/api/synthetic-samples', `Bearer ${token}`, generated)
  ])
  for (let index = 0; index < retried.length; index++) {
    assert.equal(retried[index].status, 201)
    assert.deepEqual(await retried[index].json(), {
      id: [source.id, generated.id][index],
      duplicate: false
    })
  }
  const duplicate = await send('/api/synthetic-samples', `Bearer ${token}`, generated)
  assert.equal(duplicate.status, 200)
  assert.deepEqual(await duplicate.json(), { id: generated.id, duplicate: true })
  assert.equal(store.stats()?.captures, 2)
  assert.equal(store.stats()?.samples, 3)
  assert.deepEqual(store.capture(source.id).png, Buffer.from(source.originalPng, 'base64'))
  assert.deepEqual(store.capture(generated.id).png, Buffer.from(generated.png, 'base64'))
  assert.deepEqual(store.capture(generated.id).capture.synthetic, {
    text: generated.text,
    rendering: generated.rendering
  })
})

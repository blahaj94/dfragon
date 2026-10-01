import assert from 'node:assert/strict'
import test from 'node:test'
import { once } from 'node:events'
import { request as httpRequest, type ClientRequest, type IncomingMessage } from 'node:http'
import { randomUUID } from 'node:crypto'
import { OcrAuth } from '../src/auth.js'
import { createOcrApp } from '../src/server.js'
import { OcrStore } from '../src/store.js'
import { upload } from './fixtures.js'

function gate() {
  let resolve!: () => void
  const promise = new Promise<void>((release) => {
    resolve = release
  })

  return { promise, resolve }
}

test('disconnected authentication never reserves a capture or model slot; completion, failure and cancellation release once', async (t) => {
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
    // The server has observed the disconnect before authentication is permitted to return.
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

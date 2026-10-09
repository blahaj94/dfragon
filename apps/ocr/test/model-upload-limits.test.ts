import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { request as httpRequest } from 'node:http'
import { OcrAuth } from '../src/auth.js'
import { createOcrApp } from '../src/server.js'
import { OcrStore } from '../src/store.js'
import {
  inspectModelFiles,
  MODEL_AUXILIARY_FILE_MAXIMUM_BYTES,
  MODEL_MAXIMUM_BYTES,
  MODEL_METADATA_MAXIMUM_BYTES,
  MODEL_MULTIPART_OVERHEAD_MAXIMUM_BYTES
} from '../src/model-library.js'

const boundary = 'ocr-model-limit-fixture'
const dictionary = Buffer.from('가\n')
const ignoredPart = Buffer.from(
  `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\nignored\r\n`
)
const metadata = () =>
  JSON.stringify({
    id: randomUUID(),
    name: '한도 검증',
    preset: 'korean-ppocrv5',
    kind: 'pretrained',
    parentId: null
  })

function part(name: string | undefined, bytes: Buffer | string, filename?: string) {
  let disposition = 'Content-Disposition: form-data'
  if (name !== undefined) {
    disposition += `; name="${name}"`
  }

  if (filename !== undefined) {
    disposition += `; filename="${filename}"`
  }

  return Buffer.concat([
    Buffer.from(`--${boundary}\r\n${disposition}\r\n\r\n`),
    Buffer.from(bytes),
    Buffer.from('\r\n')
  ])
}

function multipart({
  metadataText = metadata(),
  evaluation,
  extra = []
}: {
  metadataText?: string
  evaluation?: Buffer
  extra?: Buffer[]
} = {}) {
  const parts: Buffer[] = [
    part('metadata', metadataText),
    part('files', 'weights', 'weights.pdparams'),
    part('files', dictionary, 'characters.txt')
  ]
  if (evaluation !== undefined) {
    parts.push(part('files', evaluation, 'evaluation.json'))
  }
  parts.push(...extra, Buffer.from(`--${boundary}--\r\n`))

  return Buffer.concat(parts)
}

test('모델 보조 파일과 합산 bytes의 정확한 한도를 받고 각 초과를 거절한다', () => {
  const evaluation = Buffer.from('{}' + ' '.repeat(MODEL_AUXILIARY_FILE_MAXIMUM_BYTES - 2))
  const small = new Map([
    ['weights.pdparams', Buffer.from('weights')],
    ['characters.txt', dictionary]
  ])
  inspectModelFiles(new Map(small).set('evaluation.json', evaluation))
  const maximumDictionary = Buffer.from(
    Array.from(
      { length: Math.floor(MODEL_AUXILIARY_FILE_MAXIMUM_BYTES / 5) },
      (_, index) => `${String.fromCodePoint(0x10000 + index)}\n`
    ).join('') + 'a'
  )
  assert.equal(maximumDictionary.length, MODEL_AUXILIARY_FILE_MAXIMUM_BYTES)
  inspectModelFiles(new Map(small).set('characters.txt', maximumDictionary))
  assert.throws(
    () =>
      inspectModelFiles(
        new Map(small).set('evaluation.json', Buffer.concat([evaluation, Buffer.from(' ')]))
      ),
    { code: 'UPLOAD_TOO_LARGE' }
  )
  assert.throws(
    () =>
      inspectModelFiles(
        new Map(small).set('characters.txt', Buffer.alloc(MODEL_AUXILIARY_FILE_MAXIMUM_BYTES + 1))
      ),
    { code: 'UPLOAD_TOO_LARGE' }
  )
  const weights = Buffer.alloc(MODEL_MAXIMUM_BYTES - dictionary.length)
  inspectModelFiles(new Map(small).set('weights.pdparams', weights))
  assert.throws(
    () =>
      inspectModelFiles(new Map(small).set('weights.pdparams', Buffer.alloc(weights.length + 1))),
    { code: 'UPLOAD_TOO_LARGE' }
  )
})

test('모델 multipart는 메타데이터, 선택 파일, 파일 개수, 전체 파트 한도를 각각 검사한다', async (t) => {
  const f = await fixture(t)
  const send = (body: Buffer) =>
    fetch(`${f.base}/api/desktop/models`, {
      method: 'POST',
      headers: f.headers,
      body: new Uint8Array(body)
    })
  assert.equal((await send(multipart())).status, 201)
  assert.equal((await send(multipart({ evaluation: Buffer.from('{}') }))).status, 201)
  const before = f.store.models().length
  for (const extra of [
    [part('files', '{}', 'evaluation.json'), part('files', 'extra', 'extra.bin')],
    [part('extra', 'field')],
    [part(undefined, 'missing field name')],
    [ignoredPart, ignoredPart, ignoredPart]
  ]) {
    assert.equal((await send(multipart({ extra }))).status, 400)
    assert.equal(f.store.models().length, before)
  }
  // Busboy가 건너뛴 파트도 포함해 현재 Multer의 총 5개 파트 한도를 검증한다.
  assert.equal((await send(multipart({ extra: [ignoredPart] }))).status, 201)
  assert.equal((await send(multipart({ extra: [ignoredPart, ignoredPart] }))).status, 201)
  const text = metadata()
  const count = f.store.models().length
  assert.equal(
    (
      await send(
        multipart({
          metadataText:
            text + ' '.repeat(MODEL_METADATA_MAXIMUM_BYTES - 1 - Buffer.byteLength(text))
        })
      )
    ).status,
    201
  )
  for (const length of [MODEL_METADATA_MAXIMUM_BYTES, MODEL_METADATA_MAXIMUM_BYTES + 1]) {
    const value = metadata()
    assert.equal(
      (
        await send(
          multipart({ metadataText: value + ' '.repeat(length - Buffer.byteLength(value)) })
        )
      ).status,
      400
    )
    assert.equal(f.store.models().length, count + 1)
  }
  assert.equal(
    (
      await send(
        multipart({
          evaluation: Buffer.from('{}' + ' '.repeat(MODEL_AUXILIARY_FILE_MAXIMUM_BYTES - 2))
        })
      )
    ).status,
    507
  )
  assert.equal(
    (
      await send(
        multipart({
          evaluation: Buffer.from('{}' + ' '.repeat(MODEL_AUXILIARY_FILE_MAXIMUM_BYTES - 1))
        })
      )
    ).status,
    413
  )
  assert.equal(f.store.models().length, count + 1)
})

test('모델 요청 부가 bytes의 정확한 한도를 받고 초과 연결을 끊으며 파일을 저장하지 않는다', async (t) => {
  const f = await fixture(t)
  const prefix = Buffer.concat([
    part('metadata', metadata()),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="weights.pdparams"\r\n\r\n`
    )
  ])
  const suffix = Buffer.concat([
    Buffer.from('\r\n'),
    part('files', dictionary, 'characters.txt'),
    Buffer.from(`--${boundary}--\r\n`)
  ])
  const weightBytes = MODEL_MAXIMUM_BYTES - dictionary.length
  const overheadBytes = prefix.length + suffix.length - dictionary.length
  const paddingBytes = MODEL_MULTIPART_OVERHEAD_MAXIMUM_BYTES - overheadBytes
  assert(paddingBytes > 0)
  const send = async (extraBytes: number) => {
    const client = httpRequest(`${f.base}/api/desktop/models`, {
      method: 'POST',
      headers: f.headers
    })
    const response = new Promise<number | undefined>((resolve, reject) => {
      client.once('error', reject)
      client.once('response', (incoming) => {
        incoming.resume()
        incoming.once('end', () => resolve(incoming.statusCode))
      })
    })
    // 수신 한도 초과로 연결이 끊길 수 있으므로 본문 전송 전에 오류 수신을 등록한다.
    const result = response.then(
      (status) => ({ status }),
      (error: unknown) => ({ error })
    )
    client.write(
      Buffer.concat([Buffer.alloc(paddingBytes + extraBytes - 2, 120), Buffer.from('\r\n'), prefix])
    )
    const chunk = Buffer.alloc(1024 * 1024)
    try {
      for (let written = 0; written < weightBytes; written += chunk.length) {
        if (!client.write(chunk.subarray(0, Math.min(chunk.length, weightBytes - written)))) {
          await once(client, 'drain')
        }
      }
      client.end(suffix)
    } catch {
      client.destroy()
    }

    return result
  }
  const exact = await send(0)
  assert.deepEqual(exact, { status: 507 })
  const overflow = await send(1)
  assert('error' in overflow)
  assert.equal(f.store.models().length, 0)
})

async function fixture(t: TestContext) {
  const config = {
    origin: 'https://ocr.example.test',
    authOrigin: 'https://auth.example.test',
    ownerId: randomUUID()
  }
  const auth = new OcrAuth(config, async () =>
    Response.json({ user: { id: config.ownerId, nickname: '검증' } })
  )
  const store = new OcrStore(':memory:', 1024 * 1024)
  const runtime = await createOcrApp(config, store, auth)
  await runtime.app.listen(0, '127.0.0.1')
  const address = runtime.app.getHttpServer().address()
  assert(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}`
  const headers = {
    Authorization: 'Bearer synthetic.desktop.token',
    'Content-Type': `multipart/form-data; boundary=${boundary}`
  }
  t.after(async () => {
    await runtime.close()
    store.close()
  })

  return { base, headers, store }
}

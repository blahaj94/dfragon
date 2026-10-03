import assert from 'node:assert/strict'
import test from 'node:test'
import { once } from 'node:events'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import express from 'express'
import tar from 'tar-stream'
import { PNG } from 'pngjs'
import { downloadDataset } from '../src/export.js'
import { parseUpload } from '../src/images.js'
import { OcrStore } from '../src/store.js'
import { upload } from './fixtures.js'

test(
  'TAR 전송 시작 후 정답·제외·분할·자료가 바뀌어도 시작 시점 목록과 원본·크롭을 함께 내려받는다',
  { timeout: 5_000 },
  async (t) => {
    const store = new OcrStore(':memory:', 1024 * 1024)
    const original = parseUpload(upload())
    const incoming = parseUpload(upload())
    store.add(original.capture, original.png)
    const labeledId = `${original.capture.id}-1`
    store.updateSample(labeledId, { text: '시작정답', excluded: true })
    store.assign('시작정답', 'val')
    const app = express()
    let changed = false
    let completion!: Promise<void>
    app.get('/dataset', (_request, response) => {
      // 실제 HTTP writable에 TAR가 연결되는 시점은 메타데이터를 읽은 뒤,
      // 첫 archive entry 전이다. 같은 서버에서 완료된 쓰기를 전송과 경합시킨다.
      response.once('pipe', () => {
        store.updateSample(labeledId, { text: '새정답', excluded: false, confirmSplitChange: true })
        store.assign('새정답', 'test')
        store.add(incoming.capture, incoming.png)
        changed = true
      })
      completion = downloadDataset(store, response)
      void completion.catch(() => response.destroy())
    })
    const server = app.listen(0, '127.0.0.1')
    t.after(async () => {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error !== undefined) {
            reject(error)

            return
          }
          resolve()
        })
      })
      store.close()
    })
    await once(server, 'listening')
    const address = server.address()
    assert(address && typeof address === 'object')
    const response = await fetch(`http://127.0.0.1:${address.port}/dataset`, { signal: t.signal })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'application/x-tar')
    assert.equal(response.headers.get('content-disposition'), 'attachment; filename="ocr-data.tar"')
    const entries = new Map<string, Buffer>()
    const extract = tar.extract()
    extract.on('entry', (header, stream, next) => {
      assert.equal(header.type, 'file')
      assert.equal(header.mode, 0o600)
      assert.equal(entries.has(header.name), false)
      const chunks: Buffer[] = []
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', () => {
        entries.set(header.name, Buffer.concat(chunks))
        next()
      })
    })
    await pipeline(Readable.from(Buffer.from(await response.arrayBuffer())), extract)
    await completion
    assert.equal(changed, true)

    assert.deepEqual(
      [...entries.keys()].sort(),
      [
        `crops/${original.capture.id}-1.png`,
        `crops/${original.capture.id}-3.png`,
        'manifest.json',
        `originals/${original.capture.id}.png`
      ].sort()
    )
    const manifest = JSON.parse(entries.get('manifest.json')!.toString()) as ReturnType<
      OcrStore['exportManifest']
    >
    assert.equal(manifest.schemaVersion, 1)
    assert(Number.isFinite(Date.parse(manifest.exportedAt)))
    assert.deepEqual(manifest.captures, [original.capture])
    assert.deepEqual(
      manifest.samples.map(({ id, text, excluded, split }) => ({ id, text, excluded, split })),
      [
        { id: labeledId, text: '시작정답', excluded: true, split: 'val' },
        { id: `${original.capture.id}-3`, text: null, excluded: false, split: 'unassigned' }
      ]
    )
    assert.deepEqual(entries.get(`originals/${original.capture.id}.png`), original.png)
    const firstCrop = PNG.sync.read(entries.get(`crops/${original.capture.id}-1.png`)!)
    assert.equal(firstCrop.width, 3)
    assert.equal(firstCrop.height, 2)
    // upload fixture의 8×4 RGBA (i mod 256)와 직접 지정한 두 사각형에서 계산했다.
    assert.deepEqual(
      [...firstCrop.data],
      [
        36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78,
        79
      ]
    )
    const thirdCrop = PNG.sync.read(entries.get(`crops/${original.capture.id}-3.png`)!)
    assert.equal(thirdCrop.width, 2)
    assert.equal(thirdCrop.height, 2)
    assert.deepEqual(
      [...thirdCrop.data],
      [16, 17, 18, 19, 20, 21, 22, 23, 48, 49, 50, 51, 52, 53, 54, 55]
    )
    assert.equal(store.sample(labeledId).text, '새정답')
    assert.equal(store.sample(labeledId).excluded, false)
    assert.equal(store.sample(labeledId).split, 'test')
    assert.equal(store.stats()?.captures, 2)
  }
)

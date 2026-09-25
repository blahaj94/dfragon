import { expect, it, vi } from 'vitest'
import { PNG } from 'pngjs'
import type { AuthAuthorization, AuthCoordinator, AuthSnapshot } from '../auth/types'
import { createOcrDataset } from './ocr-dataset'

vi.mock('../api-fetch', () => ({ fetchApi: vi.fn() }))
const remoteSample = {
  id: '00000000-0000-4000-8000-000000000001-1',
  capturedAt: '2026-09-25T00:00:00.000Z',
  width: 2,
  height: 1,
  text: '정답',
  excluded: false,
  slot: 1,
  frameWidth: 8,
  frameHeight: 4,
  uiScale: null,
  kind: 'hud',
  split: 'test'
}
function setup(): {
  dataset: ReturnType<typeof createOcrDataset>
  request: ReturnType<typeof vi.fn<typeof fetch>>
  auth: Pick<
    AuthCoordinator,
    'captureGeneration' | 'authorization' | 'recoverAuthorization' | 'subscribe'
  >
  png: Buffer
  changeAccount: (next: number | null) => void
} {
  let generation: number | null = 1
  const listeners = new Set<(snapshot: AuthSnapshot) => void>()
  const credential: AuthAuthorization = {
    status: 'available',
    generation: 1,
    accessGeneration: 1,
    accessToken: 'synthetic.desktop.token'
  }
  const auth = {
    captureGeneration: () => generation,
    authorization: vi.fn(async () => credential),
    recoverAuthorization: vi.fn(async () => credential),
    subscribe: (listener: (snapshot: AuthSnapshot) => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
  const png = PNG.sync.write(new PNG({ width: 2, height: 1 }))
  const request = vi.fn<typeof fetch>(async (url) =>
    String(url).endsWith('/image')
      ? new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } })
      : Response.json({ exportedAt: '2026-09-26T00:00:00.000Z', samples: [remoteSample] })
  )
  const dataset = createOcrDataset(auth, request)
  return {
    dataset,
    request,
    auth,
    png,
    changeAccount: (next: number | null) => {
      generation = next
      listeners.forEach((listener) => listener({ phase: 'signedOut' } as AuthSnapshot))
    }
  }
}

it('reads a server snapshot and original crop with fixed, credential-free renderer results', async () => {
  const f = setup()
  const [sample] = await f.dataset.list()
  expect(sample).toMatchObject({
    text: '정답',
    excluded: false,
    remote: { kind: 'hud', split: 'test' },
    source: null
  })
  expect(await f.dataset.readImage(sample.id)).toBe(
    `data:image/png;base64,${f.png.toString('base64')}`
  )
  expect(f.request.mock.calls[0]).toMatchObject([
    'https://ocr.dfragon.com/api/desktop/dataset',
    { credentials: 'omit', redirect: 'error', cache: 'no-store' }
  ])
  expect(JSON.stringify(sample)).not.toContain('token')
  await expect(f.dataset.readImage('ocr:1:../../auth')).rejects.toThrow(
    'DEVELOPER_SAMPLE_NOT_FOUND'
  )
})

it('refreshes only on 401 once and distinguishes a non-owner account', async () => {
  const f = setup()
  f.request.mockResolvedValueOnce(new Response(null, { status: 401 }))
  await f.dataset.list()
  expect(f.auth.recoverAuthorization).toHaveBeenCalledTimes(1)
  f.request.mockResolvedValueOnce(new Response(null, { status: 403 }))
  await expect(f.dataset.list()).rejects.toThrow('DEVELOPER_OCR_OWNER_REQUIRED')
  expect(f.auth.recoverAuthorization).toHaveBeenCalledTimes(1)
  f.request.mockResolvedValue(new Response(null, { status: 401 }))
  await expect(f.dataset.list()).rejects.toThrow('DEVELOPER_OCR_LOGIN_REQUIRED')
  expect(f.auth.recoverAuthorization).toHaveBeenLastCalledWith(
    expect.objectContaining({ finalRejection: true }),
    expect.any(AbortSignal)
  )
})

it('rejects signed-out reads, previous snapshots and results completed after close or account change', async () => {
  const f = setup()
  const [old] = await f.dataset.list()
  await f.dataset.list()
  await expect(f.dataset.readImage(old.id)).rejects.toThrow('DEVELOPER_SAMPLE_NOT_FOUND')
  for (const invalidate of [() => f.dataset.close(), () => f.changeAccount(null)]) {
    let resolve!: (response: Response) => void
    f.request.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    const listing = f.dataset.list()
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
    invalidate()
    resolve(Response.json({ exportedAt: '2026-09-26T00:00:00.000Z', samples: [remoteSample] }))
    await expect(listing).rejects.toThrow()
  }
  const calls = f.request.mock.calls.length
  await expect(f.dataset.list()).rejects.toThrow('DEVELOPER_OCR_LOGIN_REQUIRED')
  expect(f.request).toHaveBeenCalledTimes(calls)
})

it('rejects malformed metadata, oversized bodies and mismatched image dimensions', async () => {
  const f = setup()
  f.request.mockResolvedValueOnce(
    Response.json({
      exportedAt: '2026-09-26T00:00:00.000Z',
      samples: [{ ...remoteSample, id: '../private' }]
    })
  )
  await expect(f.dataset.list()).rejects.toThrow()
  const [sample] = await f.dataset.list()
  const wrong = PNG.sync.write(new PNG({ width: 3, height: 1 }))
  f.request.mockResolvedValueOnce(
    new Response(new Uint8Array(wrong), { headers: { 'Content-Type': 'image/png' } })
  )
  await expect(f.dataset.readImage(sample.id)).rejects.toThrow('DEVELOPER_OCR_UNAVAILABLE')
  f.request.mockResolvedValueOnce(
    new Response(' '.repeat(8 * 1024 * 1024 + 1), {
      headers: { 'Content-Type': 'application/json' }
    })
  )
  await expect(f.dataset.list()).rejects.toThrow('DEVELOPER_OCR_UNAVAILABLE')
})

import { expect, it, vi } from 'vitest'
import { PNG } from 'pngjs'
import type { AuthAuthorization, AuthCoordinator, AuthSnapshot } from '../auth/types'
import {
  createOcrDataset,
  MAX_OCR_DATASET_JSON_BYTES,
  MAX_OCR_DATASET_SAMPLES
} from './ocr-dataset'

vi.mock('../api-fetch', () => {
  const fetchApi = vi.fn()

  return { fetchApi }
})
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

it('dataset sample count and JSON byte budgets are independent inclusive limits', async () => {
  const f = setup()
  const samples = Array.from({ length: MAX_OCR_DATASET_SAMPLES }, (_, index) => ({
    ...remoteSample,
    id: `${index.toString(16).padStart(8, '0')}-0000-4000-8000-000000000001-1`
  }))
  f.request.mockResolvedValueOnce(
    Response.json({ exportedAt: '2026-09-26T00:00:00.000Z', samples })
  )
  expect(await f.dataset.list()).toHaveLength(MAX_OCR_DATASET_SAMPLES)

  f.request.mockResolvedValueOnce(
    Response.json({ exportedAt: '2026-09-26T00:00:00.000Z', samples: [...samples, remoteSample] })
  )
  await expect(f.dataset.list()).rejects.toThrow()

  const empty = JSON.stringify({ exportedAt: '2026-09-26T00:00:00.000Z', samples: [] })
  f.request.mockResolvedValueOnce(
    new Response(empty.padEnd(MAX_OCR_DATASET_JSON_BYTES, ' '), {
      headers: { 'Content-Type': 'application/json' }
    })
  )
  expect(await f.dataset.list()).toEqual([])

  f.request.mockResolvedValueOnce(
    new Response(empty.padEnd(MAX_OCR_DATASET_JSON_BYTES + 1, ' '), {
      headers: { 'Content-Type': 'application/json' }
    })
  )
  await expect(f.dataset.list()).rejects.toThrow('DEVELOPER_OCR_UNAVAILABLE')
})
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
  const request = vi.fn<typeof fetch>(async (url) => {
    if (String(url).endsWith('/image')) {
      return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } })
    }

    return Response.json({ exportedAt: '2026-09-26T00:00:00.000Z', samples: [remoteSample] })
  })
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

it('reads raid sample IDs ending in 10..12 and rejects incompatible kind or ID suffixes', async () => {
  const f = setup()
  const samples = [10, 11, 12].map((slot) => {
    const sample = { ...remoteSample, slot, kind: 'raid', uiScale: 1 }
    const id = `00000000-0000-4000-8000-000000000001-${slot}`
    sample.id = id

    return sample
  })
  f.request.mockResolvedValueOnce(
    Response.json({ exportedAt: '2026-09-26T00:00:00.000Z', samples })
  )
  const listed = await f.dataset.list()
  expect(listed.map((sample) => sample.source)).toEqual(
    [10, 11, 12].map((slot) => ({ kind: 'raid', slot, frameWidth: 8, frameHeight: 4, scale: 1 }))
  )
  expect(await f.dataset.readImage(listed[2].id)).toBe(
    `data:image/png;base64,${f.png.toString('base64')}`
  )
  expect(f.request.mock.calls.at(-1)?.[0]).toBe(
    'https://ocr.dfragon.com/api/desktop/samples/00000000-0000-4000-8000-000000000001-12/image'
  )
  for (const invalid of [
    { ...samples[0], kind: 'hud' },
    { ...samples[0], kind: 'participants' },
    { ...samples[0], slot: 13 },
    { ...samples[0], slot: 11 }
  ]) {
    f.request.mockResolvedValueOnce(
      Response.json({ exportedAt: '2026-09-26T00:00:00.000Z', samples: [invalid] })
    )
    await expect(f.dataset.list()).rejects.toThrow()
  }
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

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
    recoverAuthorization: vi.fn(async () => ({
      ...credential,
      accessGeneration: 2,
      accessToken: 'synthetic.refreshed.token'
    })),
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

it('401 목록 조회는 새 토큰으로 한 번 재요청하고 소유자 권한 거절과 최종 401을 구분한다', async () => {
  const f = setup()
  f.request.mockResolvedValueOnce(new Response(null, { status: 401 }))
  await f.dataset.list()
  expect(f.auth.recoverAuthorization).toHaveBeenCalledTimes(1)
  expect(f.request).toHaveBeenCalledTimes(2)
  expect(f.request.mock.calls[0][1]?.headers).toEqual({
    Authorization: 'Bearer synthetic.desktop.token'
  })
  expect(f.request.mock.calls[1][1]?.headers).toEqual({
    Authorization: 'Bearer synthetic.refreshed.token'
  })
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

it('정답의 null과 빈 문자열 및 제외·분할을 서버 조회 시점의 값으로 보존한다', async () => {
  const f = setup()
  f.request.mockResolvedValueOnce(
    Response.json({
      exportedAt: '2026-09-26T00:00:00.000Z',
      samples: [
        { ...remoteSample, text: null, excluded: true, split: 'unassigned' },
        { ...remoteSample, id: '00000000-0000-4000-8000-000000000002-1', text: '', split: 'train' }
      ]
    })
  )

  const samples = await f.dataset.list()

  expect(samples.map(({ text, excluded, remote }) => ({ text, excluded, remote }))).toEqual([
    { text: null, excluded: true, remote: { kind: 'hud', split: 'unassigned' } },
    { text: '', excluded: false, remote: { kind: 'hud', split: 'train' } }
  ])
  expect(f.request).toHaveBeenCalledOnce()
})

it.each([
  { name: '소유자 권한 없음', status: 403, error: 'DEVELOPER_OCR_OWNER_REQUIRED' },
  { name: '요청 제한', status: 429, error: 'DEVELOPER_OCR_UNAVAILABLE' },
  { name: '서버 장애', status: 503, error: 'DEVELOPER_OCR_UNAVAILABLE' }
])('$name 목록 응답은 재인증이나 자동 재조회 없이 거절한다', async ({ status, error }) => {
  const f = setup()
  const response = new Response('server rejection', { status })
  const cancel = vi.spyOn(response.body!, 'cancel')
  f.request.mockResolvedValueOnce(response)

  await expect(f.dataset.list()).rejects.toThrow(error)
  expect(f.request).toHaveBeenCalledOnce()
  expect(f.auth.recoverAuthorization).not.toHaveBeenCalled()
  expect(cancel).toHaveBeenCalledOnce()
})

it('401 재인증을 기다리는 동안 계정이 바뀌면 새 계정 토큰으로 재조회하지 않는다', async () => {
  const f = setup()
  let completeRecovery!: (value: AuthAuthorization) => void
  const recovering = new Promise<AuthAuthorization>((resolve) => {
    completeRecovery = resolve
  })
  vi.mocked(f.auth.recoverAuthorization).mockReturnValueOnce(recovering)
  f.request.mockResolvedValueOnce(new Response(null, { status: 401 }))
  const listing = f.dataset.list()
  await vi.waitFor(() => expect(f.auth.recoverAuthorization).toHaveBeenCalledOnce())

  f.changeAccount(2)
  completeRecovery({
    status: 'available',
    generation: 2,
    accessGeneration: 2,
    accessToken: 'synthetic.other.token'
  })

  await expect(listing).rejects.toThrow('DEVELOPER_OCR_LOGIN_REQUIRED')
  expect(f.request).toHaveBeenCalledOnce()
  expect(f.request.mock.calls[0][1]?.signal?.aborted).toBe(true)
})

it('다시 불러오기는 읽는 중인 이전 크롭을 취소하고 새 스냅샷만 읽게 한다', async () => {
  const f = setup()
  const [oldSample] = await f.dataset.list()
  const cancel = vi.fn()
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(f.png))
      },
      cancel
    }),
    { headers: { 'Content-Type': 'image/png' } }
  )
  const getReader = vi.spyOn(response.body!, 'getReader')
  f.request.mockResolvedValueOnce(response)
  const reading = f.dataset.readImage(oldSample.id)
  // 취소의 rejection을 즉시 관찰해 진행 중 목록 갱신과 unhandled rejection이 경쟁하지 않게 한다.
  const cancelled = expect(reading).rejects.toMatchObject({ name: 'AbortError' })
  await vi.waitFor(() => expect(getReader).toHaveBeenCalledOnce())

  const [newSample] = await f.dataset.list()

  await cancelled
  expect(cancel).toHaveBeenCalledOnce()
  expect(f.request.mock.calls[1][1]?.signal?.aborted).toBe(true)
  await expect(f.dataset.readImage(oldSample.id)).rejects.toThrow('DEVELOPER_SAMPLE_NOT_FOUND')
  expect(await f.dataset.readImage(newSample.id)).toBe(
    `data:image/png;base64,${f.png.toString('base64')}`
  )
})

it('서버 목록 본문도 15초 안에 완료해야 하며 시간 초과 뒤 타이머와 본문을 해제한다', async () => {
  vi.useFakeTimers()
  try {
    const f = setup()
    const cancel = vi.fn()
    const response = new Response(new ReadableStream<Uint8Array>({ cancel }), {
      headers: { 'Content-Type': 'application/json' }
    })
    f.request.mockResolvedValueOnce(response)
    const listing = f.dataset.list()
    const rejected = expect(listing).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(14_999)
    expect(f.request).toHaveBeenCalledOnce()
    expect(f.request.mock.calls[0][1]?.signal?.aborted).toBe(false)
    expect(cancel).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    await rejected
    expect(f.request.mock.calls[0][1]?.signal?.aborted).toBe(true)
    expect(cancel).toHaveBeenCalledOnce()
    expect(f.request).toHaveBeenCalledOnce()
    expect(f.auth.recoverAuthorization).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})

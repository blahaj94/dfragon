import { expect, it, vi, type Mock } from 'vitest'
import { PNG } from 'pngjs'
import { createOcrUploader } from './ocr-upload'
import { previewFrame, type CapturedPartyFrame } from './collection-session'
import type { AuthAuthorization } from '../auth/types'

vi.mock('../api-fetch', () => ({ fetchApi: vi.fn() }))

const frame: CapturedPartyFrame = {
  width: 2,
  height: 2,
  scale: 1,
  capturedAt: '2026-09-25T12:30:00.000Z',
  slots: [{ slot: 3, width: 1, height: 1, rgba: Buffer.from([11, 22, 33, 255]) }],
  original: {
    rgba: Buffer.from([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 11, 22, 33, 255]),
    crops: [{ slot: 3, x: 1, y: 1, width: 1, height: 1 }]
  }
}

function setup(): {
  prepare: ReturnType<typeof createOcrUploader>
  auth: {
    captureGeneration(): number | null
    authorization: Mock<() => Promise<AuthAuthorization>>
    recoverAuthorization: Mock<() => Promise<AuthAuthorization>>
    subscribe: Mock<(callback: () => void) => Mock>
  }
  request: Mock<typeof fetch>
  unsubscribe: Mock
  changeAccount(next: number | null): void
} {
  let generation: number | null = 1
  let listener: (() => void) | undefined
  const credential: AuthAuthorization = {
    status: 'available',
    generation: 1,
    accessGeneration: 1,
    accessToken: 'synthetic.desktop.token'
  }
  const unsubscribe = vi.fn()
  const auth = {
    captureGeneration: () => generation,
    authorization: vi.fn<() => Promise<AuthAuthorization>>(async () => credential),
    recoverAuthorization: vi.fn<() => Promise<AuthAuthorization>>(async () => credential),
    subscribe: vi.fn((callback: () => void) => {
      listener = callback
      return unsubscribe
    })
  }
  const request = vi.fn<typeof fetch>(async (_url, init) =>
    Response.json({ id: JSON.parse(String(init?.body)).id, duplicate: false }, { status: 201 })
  )
  const prepare = createOcrUploader(auth, request)
  return {
    prepare,
    auth,
    request,
    unsubscribe,
    changeAccount: (next: number | null) => {
      generation = next
      listener?.()
    }
  }
}

it('sends main-owned original pixels and selected coordinates with a credential and no labels', async () => {
  const f = setup()
  expect(await f.prepare()!(frame, [3], 'participants', new AbortController().signal)).toBe(
    'uploaded'
  )
  const [url, init] = f.request.mock.calls[0]
  expect(url).toBe('https://ocr.dfragon.com/api/desktop/captures')
  expect(init).toMatchObject({
    credentials: 'omit',
    redirect: 'error',
    headers: { Authorization: 'Bearer synthetic.desktop.token' }
  })
  const body = JSON.parse(String(init?.body))
  expect(body).toMatchObject({
    kind: 'participants',
    crops: frame.original!.crops,
    uiScaleSource: 'estimated'
  })
  expect(body).not.toHaveProperty('text')
  expect(PNG.sync.read(Buffer.from(body.originalPng, 'base64')).data).toEqual(frame.original!.rgba)
  expect(previewFrame(frame)).not.toHaveProperty('original')
  expect(f.unsubscribe).toHaveBeenCalledOnce()
})

it('never queues signed-out captures or sends under an account that logged in later', async () => {
  const f = setup()
  f.changeAccount(null)
  expect(f.prepare()).toBeNull()
  f.changeAccount(1)
  const send = f.prepare()!
  f.changeAccount(2)
  expect(await send(frame, [3], 'hud', new AbortController().signal)).toBe('signedOut')
  expect(f.request).not.toHaveBeenCalled()
})

it('cancels a request on logout and does not retry network failures', async () => {
  const f = setup()
  let signal: AbortSignal | undefined
  f.request.mockImplementationOnce(
    async (_url, init) =>
      new Promise((_resolve, reject) => {
        signal = init?.signal as AbortSignal
        signal.addEventListener('abort', () => reject(new Error('private transport detail')), {
          once: true
        })
      })
  )
  const sent = f.prepare()!(frame, [3], 'hud', new AbortController().signal)
  await vi.waitFor(() => expect(f.request).toHaveBeenCalledOnce())
  f.changeAccount(null)
  expect(signal?.aborted).toBe(true)
  expect(await sent).toBe('signedOut')
  expect(f.request).toHaveBeenCalledOnce()
  const other = setup()
  other.request.mockRejectedValueOnce(new Error('private transport detail'))
  expect(await other.prepare()!(frame, [3], 'hud', new AbortController().signal)).toBe('failed')
  expect(other.request).toHaveBeenCalledOnce()
})

it('uses the same capture on one credential refresh, and rejects a mismatched receipt', async () => {
  const f = setup()
  f.request.mockResolvedValueOnce(new Response(null, { status: 401 }))
  expect(await f.prepare()!(frame, [3], 'hud', new AbortController().signal)).toBe('uploaded')
  expect(f.auth.recoverAuthorization).toHaveBeenCalledWith(
    { generation: 1, accessGeneration: 1, finalRejection: false },
    expect.any(AbortSignal)
  )
  expect(f.request.mock.calls[0][1]?.body).toBe(f.request.mock.calls[1][1]?.body)
  f.request.mockResolvedValueOnce(
    Response.json({ id: '00000000-0000-4000-8000-000000000000', duplicate: false })
  )
  expect(await f.prepare()!(frame, [3], 'hud', new AbortController().signal)).toBe('failed')
})

it('does not send when cancelled during credential preparation', async () => {
  const f = setup()
  const controller = new AbortController()
  f.auth.authorization.mockImplementationOnce(async () => {
    controller.abort()
    return { status: 'unavailable' }
  })
  expect(await f.prepare()!(frame, [3], 'hud', controller.signal)).toBe('signedOut')
  expect(f.request).not.toHaveBeenCalled()
})

it('bounds a stalled upload and releases its auth subscription without retrying', async () => {
  vi.useFakeTimers()
  try {
    const f = setup()
    f.request.mockImplementationOnce(
      async (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('timeout')), {
            once: true
          })
        })
    )
    const sent = f.prepare()!(frame, [3], 'hud', new AbortController().signal)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(await sent).toBe('failed')
    expect(f.request).toHaveBeenCalledOnce()
    expect(f.unsubscribe).toHaveBeenCalledOnce()
  } finally {
    vi.useRealTimers()
  }
})

import { afterEach, expect, it, vi } from 'vitest'
import { createServerVersionReader } from './http'

vi.mock('../api-fetch', () => {
  const fetchApi = vi.fn()

  return { fetchApi }
})
const origins = {
  apiOrigin: 'https://api.example.test',
  accountsOrigin: 'https://accounts.example.test'
}
const commit = 'a'.repeat(40)

afterEach(() => vi.useRealTimers())

it('reads each configured service without cookies, authentication or redirects', async () => {
  const transport = vi.fn<typeof fetch>(async (url) => {
    let service: 'api' | 'accounts' | 'ocr'
    if (String(url).includes('api.example')) {
      service = 'api'
    } else if (String(url).includes('accounts.example')) {
      service = 'accounts'
    } else {
      service = 'ocr'
    }

    return Response.json({ service, commit })
  })
  const read = createServerVersionReader({ ...origins, fetch: transport })
  expect(await read()).toEqual({
    api: { status: 'available', commit },
    accounts: { status: 'available', commit },
    ocr: { status: 'available', commit }
  })
  expect(transport.mock.calls.map(([url]) => url)).toEqual([
    'https://api.example.test/version',
    'https://accounts.example.test/version',
    'https://ocr.dfragon.com/version'
  ])
  for (const [, init] of transport.mock.calls) {
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  }
})

it('isolates unsupported and failed services while preserving a development build with no commit', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockRejectedValueOnce(new Error('synthetic failure'))
    .mockResolvedValueOnce(Response.json({ service: 'ocr', commit: null }))
  expect(await createServerVersionReader({ ...origins, fetch: transport })()).toEqual({
    api: { status: 'unsupported' },
    accounts: { status: 'unavailable' },
    ocr: { status: 'available', commit: null }
  })
})

it.each([
  { service: 'accounts', commit },
  { service: 'api', commit: `${commit}\n` },
  { service: 'api', commit: commit.toUpperCase() },
  { service: 'api', commit, extra: 'not public metadata' },
  { service: 'api' }
])('rejects malformed or misidentified metadata %j', async (body) => {
  const transport = vi.fn<typeof fetch>(async () => Response.json(body))
  const result = await createServerVersionReader({ ...origins, fetch: transport })()
  expect(result.api).toEqual({ status: 'unavailable' })
})

it('rejects oversized JSON and redirects and does not request missing configured origins', async () => {
  const transport = vi.fn<typeof fetch>(
    async () =>
      new Response(' '.repeat(16_385), { headers: { 'Content-Type': 'application/json' } })
  )
  expect(
    await createServerVersionReader({ apiOrigin: null, accountsOrigin: null, fetch: transport })()
  ).toEqual({
    api: { status: 'unavailable' },
    accounts: { status: 'unavailable' },
    ocr: { status: 'unavailable' }
  })
  expect(transport).toHaveBeenCalledOnce()

  const redirected = Response.json({ service: 'api', commit })
  Object.defineProperty(redirected, 'redirected', { value: true })
  transport.mockImplementation(async () => redirected)
  expect((await createServerVersionReader({ ...origins, fetch: transport })()).api).toEqual({
    status: 'unavailable'
  })
})

it('bounds a stalled fetch without hiding the other service results', async () => {
  vi.useFakeTimers()
  const transport = vi.fn<typeof fetch>(async (url, init) => {
    if (!String(url).includes('api.example')) {
      return Response.json({
        service: String(url).includes('accounts.example') ? 'accounts' : 'ocr',
        commit
      })
    }

    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    })
  })
  const result = createServerVersionReader({ ...origins, fetch: transport })()
  await vi.advanceTimersByTimeAsync(4_000)
  expect(await result).toEqual({
    api: { status: 'unavailable' },
    accounts: { status: 'available', commit },
    ocr: { status: 'available', commit }
  })
})

it('also bounds a stalled response body and cancels its reader', async () => {
  vi.useFakeTimers()
  const cancel = vi.fn()
  const transport = vi.fn<typeof fetch>(async (url) => {
    if (String(url).includes('api.example')) {
      return new Response(new ReadableStream({ cancel }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(null, { status: 404 })
  })
  const result = createServerVersionReader({ ...origins, fetch: transport })()
  await vi.advanceTimersByTimeAsync(4_000)
  expect((await result).api).toEqual({ status: 'unavailable' })
  expect(cancel).toHaveBeenCalledOnce()
})

it('rejects a response delivered from a different URL even if transport did not flag a redirect', async () => {
  const response = Response.json({ service: 'api', commit })
  Object.defineProperty(response, 'url', { value: 'https://untrusted.example/version' })
  const transport = vi.fn<typeof fetch>(async () => response)
  expect((await createServerVersionReader({ ...origins, fetch: transport })()).api).toEqual({
    status: 'unavailable'
  })
})

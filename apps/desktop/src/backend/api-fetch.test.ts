import { afterEach, describe, expect, it, vi } from 'vitest'
import { session } from 'electron'
import { createAuthHttpClient } from './auth/http'
import { createSearchHttp } from './search/http'

vi.mock('electron', () => ({ session: { fromPartition: vi.fn() } }))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Desktop API system networking', () => {
  it('uses isolated Chromium networking for login and anonymous search', async () => {
    const nodeFetch = vi.fn(async () => {
      throw new Error('Node transport must not handle Desktop API requests')
    })
    vi.stubGlobal('fetch', nodeFetch)
    const requests: Request[] = []
    const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      requests.push(request)
      const value = request.url.endsWith('/me')
        ? { user: { id: '20000000-0000-4000-8000-000000000001', nickname: '모험가000001' } }
        : { rows: [] }
      return new Response(JSON.stringify(value), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    })
    vi.mocked(session.fromPartition).mockReturnValue({
      fetch: transport
    } as unknown as Electron.Session)
    const apiOrigin = 'https://api.synthetic.test'
    const signal = new AbortController().signal

    const me = await createAuthHttpClient({ apiOrigin }).me('synthetic-access', signal)
    const rows = await createSearchHttp({ apiOrigin })({
      nickname: 'synthetic-character',
      signal
    })

    expect(me.user.nickname).toBe('모험가000001')
    expect(rows).toEqual([])
    expect(nodeFetch).not.toHaveBeenCalled()
    expect(session.fromPartition).toHaveBeenCalledWith('ldb-api', { cache: false })
    expect(requests).toHaveLength(2)
    for (const request of requests) {
      expect(request.credentials).toBe('omit')
      expect(request.redirect).toBe('error')
      expect(request.cache).toBe('no-store')
    }
    expect(requests[0].headers.get('authorization')).toBe('Bearer synthetic-access')
    expect(requests[1].headers.get('authorization')).toBeNull()
    for (const [, options] of transport.mock.calls) {
      expect(options).toMatchObject({ bypassCustomProtocolHandlers: true })
    }
  })
})

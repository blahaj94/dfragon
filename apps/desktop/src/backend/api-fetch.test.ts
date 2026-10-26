import { afterEach, describe, expect, it, vi } from 'vitest'
import { session } from 'electron'
import { createSearchHttp } from './search/http'

vi.mock('electron', () => {
  const fromPartition = vi.fn()

  return { session: { fromPartition } }
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Desktop API system networking', () => {
  it('uses isolated Chromium networking for search', async () => {
    const nodeFetch = vi.fn(async () => {
      throw new Error('Node transport must not handle Desktop API requests')
    })
    vi.stubGlobal('fetch', nodeFetch)
    const requests: Request[] = []
    const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      requests.push(request)

      return new Response(JSON.stringify({ rows: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    })
    vi.mocked(session.fromPartition).mockReturnValue({
      fetch: transport
    } as unknown as Electron.Session)
    const apiOrigin = 'https://api.synthetic.test'
    const signal = new AbortController().signal

    const rows = await createSearchHttp({ apiOrigin })({
      nickname: 'synthetic-character',
      signal
    })

    expect(rows).toEqual([])
    expect(nodeFetch).not.toHaveBeenCalled()
    expect(session.fromPartition).toHaveBeenCalledWith('dfragon-api', { cache: false })
    expect(requests).toHaveLength(1)
    expect(requests[0].credentials).toBe('omit')
    expect(requests[0].redirect).toBe('error')
    expect(requests[0].cache).toBe('no-store')
    expect(requests[0].headers.get('authorization')).toBeNull()
    for (const [, options] of transport.mock.calls) {
      expect(options).toMatchObject({ bypassCustomProtocolHandlers: true })
    }
  })
})

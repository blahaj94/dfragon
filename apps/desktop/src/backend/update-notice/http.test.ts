import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { ResponseSizeError, TimeoutError } from 'ky'
import { afterEach, expect, it, vi } from 'vitest'
import { readReleaseFeed } from './http'

const FEED_URL = 'https://github.com/blahaj94/dfragon/releases.atom'

afterEach(() => {
  vi.useRealTimers()
})

it('고정 feed 주소를 cookie, 인증 정보 없이 고정 언어 header로 요청하고 UTF-8 본문을 돌려준다', async () => {
  const body = '<feed xmlns="http://www.w3.org/2005/Atom"><title>일반 캡처</title></feed>'
  const transport = vi.fn<typeof fetch>(async () => new Response(body, { status: 200 }))

  await expect(readReleaseFeed(transport, new AbortController().signal)).resolves.toBe(body)

  expect(transport).toHaveBeenCalledOnce()
  const request = new Request(...transport.mock.calls[0])
  expect(request.url).toBe(FEED_URL)
  expect(request.method).toBe('GET')
  expect(request.credentials).toBe('omit')
  expect(request.redirect).toBe('error')
  expect(request.cache).toBe('no-store')
  expect([...request.headers]).toEqual([
    ['accept', 'application/atom+xml'],
    ['accept-language', 'en-US']
  ])
})

it.each([
  ['오류 상태', () => new Response('unavailable', { status: 503 })],
  ['UTF-8이 아닌 본문', () => new Response(new Uint8Array([0xff, 0xfe]), { status: 200 })]
])('%s 응답은 본문을 돌려주지 않고 실패한다', async (_name, respond) => {
  const transport = vi.fn<typeof fetch>(async () => respond())

  await expect(readReleaseFeed(transport, new AbortController().signal)).rejects.toThrow()
  expect(transport).toHaveBeenCalledOnce()
})

it('상한을 넘는 본문은 읽기를 멈추고 stream을 취소한다', async () => {
  const cancel = vi.fn()
  const chunk = new Uint8Array(512 * 1024)
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(chunk)
    },
    cancel
  })
  const transport = vi.fn<typeof fetch>(async () => new Response(stream, { status: 200 }))

  await expect(readReleaseFeed(transport, new AbortController().signal)).rejects.toBeInstanceOf(
    ResponseSizeError
  )
  expect(cancel).toHaveBeenCalledOnce()
})

it('실제 HTTP redirect를 따라가지 않고 실패한다', async () => {
  const paths: string[] = []
  const server = createServer((request, response) => {
    paths.push(request.url ?? '')
    response.writeHead(302, { Location: '/should-not-follow' }).end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  const transport: typeof fetch = (input, init) => {
    const original = new Request(input, init)
    const url = new URL(original.url)

    return globalThis.fetch(new Request(`http://127.0.0.1:${port}${url.pathname}`, original))
  }
  try {
    await expect(readReleaseFeed(transport, new AbortController().signal)).rejects.toThrow()
    expect(paths).toEqual(['/blahaj94/dfragon/releases.atom'])
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
})

it.each(['header', 'body'] as const)(
  '%s가 오지 않으면 대기 상한 뒤 timeout으로 실패하고 요청을 중단한다',
  async (stall) => {
    vi.useFakeTimers()
    const neverSettles = (signal: AbortSignal): Promise<never> =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    let signal: AbortSignal | undefined
    let markWaiting!: () => void
    const waiting = new Promise<void>((resolve) => {
      markWaiting = resolve
    })
    const transport = vi.fn<typeof fetch>(async (input, init) => {
      const requestSignal = new Request(input, init).signal
      signal = requestSignal
      if (stall === 'header') {
        markWaiting()

        return neverSettles(requestSignal)
      }
      const pull = (): Promise<never> => {
        markWaiting()

        return neverSettles(requestSignal)
      }

      return new Response(new ReadableStream({ pull }, { highWaterMark: 0 }))
    })

    const failure = expect(
      readReleaseFeed(transport, new AbortController().signal)
    ).rejects.toBeInstanceOf(TimeoutError)
    await waiting
    // 대기 상한 값을 고정하지 않도록 어떤 상한보다도 넉넉히 진행한다.
    await vi.advanceTimersByTimeAsync(60_000)
    await failure
    expect(signal?.aborted).toBe(true)
  }
)

it('호출자가 취소하면 요청을 중단한다', async () => {
  let signal: AbortSignal | undefined
  const transport = vi.fn<typeof fetch>(
    (input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const requestSignal = new Request(input, init).signal
        signal = requestSignal
        requestSignal.addEventListener('abort', () => reject(requestSignal.reason), {
          once: true
        })
      })
  )
  const caller = new AbortController()

  const canceled = readReleaseFeed(transport, caller.signal)
  await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce())
  caller.abort()

  await expect(canceled).rejects.toThrow()
  expect(signal?.aborted).toBe(true)
})

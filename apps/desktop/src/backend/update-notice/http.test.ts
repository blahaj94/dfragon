import { afterEach, expect, it, vi } from 'vitest'
import { readReleaseFeed } from './http'

const FEED_URL = 'https://github.com/blahaj94/dfragon/releases.atom'
const MAX_BYTES = 2 * 1024 * 1024

afterEach(() => {
  vi.useRealTimers()
})

function respondFrom(url: string, redirected: boolean): Response {
  const response = new Response('<feed xmlns="http://www.w3.org/2005/Atom"></feed>', {
    status: 200
  })
  Object.defineProperty(response, 'url', { value: url })
  Object.defineProperty(response, 'redirected', { value: redirected })

  return response
}

it('고정 feed 주소를 cookie, 인증 정보 없이 고정 언어 header로 요청하고 UTF-8 본문을 돌려준다', async () => {
  const body = '<feed xmlns="http://www.w3.org/2005/Atom"><title>일반 캡처</title></feed>'
  const transport = vi.fn<typeof fetch>(async () => new Response(body, { status: 200 }))

  await expect(readReleaseFeed(transport, new AbortController().signal)).resolves.toBe(body)

  expect(transport).toHaveBeenCalledExactlyOnceWith(FEED_URL, {
    method: 'GET',
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    headers: { Accept: 'application/atom+xml', 'Accept-Language': 'en-US' },
    signal: expect.any(AbortSignal)
  })
})

it.each([
  ['오류 상태', () => new Response('unavailable', { status: 503 })],
  [
    '선언한 크기 초과',
    () => new Response('x', { status: 200, headers: { 'content-length': String(MAX_BYTES + 1) } })
  ],
  ['UTF-8이 아닌 본문', () => new Response(new Uint8Array([0xff, 0xfe]), { status: 200 })],
  ['redirect를 거친', () => respondFrom(FEED_URL, true)],
  ['다른 주소의', () => respondFrom('https://example.test/releases.atom', false)]
])('%s 응답은 본문을 돌려주지 않고 실패한다', async (_name, respond) => {
  const transport = vi.fn<typeof fetch>(async () => respond())

  await expect(readReleaseFeed(transport, new AbortController().signal)).rejects.toThrow()
})

it('선언 없이 상한을 넘는 본문은 읽기를 멈추고 stream을 취소한다', async () => {
  const cancel = vi.fn()
  const chunk = new Uint8Array(512 * 1024)
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(chunk)
    },
    cancel
  })
  const transport = vi.fn<typeof fetch>(async () => new Response(stream, { status: 200 }))

  await expect(readReleaseFeed(transport, new AbortController().signal)).rejects.toThrow(
    'UPDATE_FEED_INVALID'
  )
  expect(cancel).toHaveBeenCalledOnce()
})

it('응답이 상한 시간 안에 오지 않거나 호출자가 취소하면 요청을 중단한다', async () => {
  vi.useFakeTimers()
  const signals: AbortSignal[] = []
  const transport = vi.fn<typeof fetch>(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init!.signal!
        signals.push(signal)
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
  )

  const slow = readReleaseFeed(transport, new AbortController().signal)
  const slowFailure = expect(slow).rejects.toThrow()
  await vi.advanceTimersByTimeAsync(9_999)
  expect(signals[0].aborted).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  await slowFailure

  const caller = new AbortController()
  const canceled = readReleaseFeed(transport, caller.signal)
  caller.abort()
  await expect(canceled).rejects.toThrow()
  expect(signals[1].aborted).toBe(true)
})

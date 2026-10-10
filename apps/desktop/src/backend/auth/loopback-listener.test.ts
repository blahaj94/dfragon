import { createServer, request, type Server } from 'node:http'
import { connect } from 'node:net'
import { once } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openLoopbackListener } from './loopback-listener'
import { CODE, OTHER_CODE, deferred } from './auth-test-fixtures'
import type { LoginReturnListener } from './types'

vi.mock('node:http', async (importOriginal) => {
  const http = await importOriginal<typeof import('node:http')>()
  const createServer = vi.fn(http.createServer)

  return { ...http, createServer }
})

const listeners: LoginReturnListener[] = []

afterEach(() => {
  for (const listener of listeners.splice(0)) {
    listener.close()
  }
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

function currentServer(): Server {
  return vi.mocked(createServer).mock.results.at(-1)!.value
}

async function open(onReturn = vi.fn(async () => {})): Promise<LoginReturnListener> {
  const listener = await openLoopbackListener(new AbortController().signal, onReturn)
  listeners.push(listener)

  return listener
}

function send(
  returnUrl: string,
  path: string,
  method = 'GET',
  headers: Record<string, string> = {}
): Promise<{ status: number; headers: Record<string, unknown>; body: string }> {
  const url = new URL(returnUrl)

  return new Promise((resolve, reject) => {
    const outgoing = request(
      { hostname: '127.0.0.1', port: url.port, path, method, headers, agent: false },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('error', reject)
        response.on('end', () => {
          resolve({
            status: response.statusCode!,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8')
          })
        })
      }
    )
    outgoing.on('error', reject)
    outgoing.end()
  })
}

describe('로그인 loopback HTTP 수신기', () => {
  it('다른 로컬 서비스의 127.0.0.1 cookie가 붙은 복귀도 받는다', async () => {
    const onReturn = vi.fn(async () => {})
    const listener = await open(onReturn)
    const cookie = Array.from({ length: 8 }, (_, index) => `local${index}=${'x'.repeat(1_000)}`)

    const response = await send(listener.returnUrl, `/auth/callback?code=${CODE}`, 'GET', {
      cookie: cookie.join('; ')
    })

    expect(response.status).toBe(200)
    expect(onReturn).toHaveBeenCalledExactlyOnceWith(`${listener.returnUrl}?code=${CODE}`)
  })

  it('127.0.0.1의 임시 포트에서 한 번 받고 교환 완료 전에 자산을 포함한 완료 HTML을 보낸다', async () => {
    const exchange = deferred<void>()
    const onReturn = vi.fn(() => exchange.promise)
    const listener = await open(onReturn)
    const address = currentServer().address()
    expect(address).toMatchObject({ address: '127.0.0.1', family: 'IPv4' })
    const port = Number(new URL(listener.returnUrl).port)
    expect(port).toBeGreaterThanOrEqual(1024)
    expect(port).toBeLessThanOrEqual(65535)
    const response = await send(listener.returnUrl, `/auth/callback?code=${CODE}`)
    expect(response.status).toBe(200)
    expect(response.headers).toMatchObject({
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer'
    })
    expect(response.body).toContain('로그인 완료')
    expect(response.body).toContain('이 탭을 닫아도 됩니다.')
    expect(response.body).toContain('data:image/png;base64,')
    expect(response.body).toContain('data:font/woff2;base64,')
    expect(response.body).not.toContain(CODE)
    expect(response.body).not.toContain('<button')
    expect(onReturn).toHaveBeenCalledExactlyOnceWith(`${listener.returnUrl}?code=${CODE}`)
    expect(currentServer().listening).toBe(false)
    await expect(send(listener.returnUrl, `/auth/callback?code=${OTHER_CODE}`)).rejects.toThrow()
    exchange.resolve()
  })

  it.each([
    ['POST', `/auth/callback?code=${CODE}`],
    ['HEAD', `/auth/callback?code=${CODE}`],
    ['GET', '/favicon.ico'],
    ['GET', `/other?code=${CODE}`],
    ['GET', `/auth/../auth/callback?code=${CODE}`],
    ['GET', `/auth/%63allback?code=${CODE}`],
    ['GET', '/auth/callback'],
    ['GET', `/auth/callback?code=${CODE}&code=${CODE}`],
    ['GET', `/auth/callback?code=${CODE}&state=extra`],
    ['GET', `/auth/callback?%63ode=${CODE}`],
    ['GET', `/auth/callback?code=${CODE}#fragment`]
  ])('%s %s에는 404를 보내고 정상 callback을 계속 기다린다', async (method, path) => {
    const onReturn = vi.fn(async () => {})
    const listener = await open(onReturn)
    expect((await send(listener.returnUrl, path, method)).status).toBe(404)
    expect(onReturn).not.toHaveBeenCalled()
    expect((await send(listener.returnUrl, `/auth/callback?code=${CODE}`)).status).toBe(200)
    expect(onReturn).toHaveBeenCalledOnce()
  })

  it('실제 수신 주소와 정상 code를 담은 absolute-form 요청도 404로 거절한다', async () => {
    const onReturn = vi.fn(async () => {})
    const listener = await open(onReturn)
    const response = await send(listener.returnUrl, `${listener.returnUrl}?code=${CODE}`)
    expect(response.status).toBe(404)
    expect(onReturn).not.toHaveBeenCalled()
    expect((await send(listener.returnUrl, `/auth/callback?code=${CODE}`)).status).toBe(200)
    expect(onReturn).toHaveBeenCalledExactlyOnceWith(`${listener.returnUrl}?code=${CODE}`)
  })

  it('Host가 수신 주소와 다르면 거절한다', async () => {
    const onReturn = vi.fn(async () => {})
    const listener = await open(onReturn)
    const response = await send(listener.returnUrl, `/auth/callback?code=${CODE}`, 'GET', {
      Host: 'attacker.example'
    })
    expect(response.status).toBe(404)
    expect(onReturn).not.toHaveBeenCalled()
    expect(currentServer().listening).toBe(true)
  })

  it('loopback 밖 원격 주소는 403으로 거부하고 code를 전달하지 않는다', async () => {
    const onReturn = vi.fn(async () => {})
    const listener = await open(onReturn)
    // Only the observed address is synthetic; the request still goes to 127.0.0.1.
    currentServer().once('connection', (socket) => {
      Object.defineProperty(socket, 'remoteAddress', { value: '203.0.113.1' })
    })
    expect((await send(listener.returnUrl, `/auth/callback?code=${CODE}`)).status).toBe(403)
    expect(onReturn).not.toHaveBeenCalled()
    expect((await send(listener.returnUrl, `/auth/callback?code=${CODE}`)).status).toBe(200)
  })

  it('동시에 도착한 두 code도 한 번만 전달한다', async () => {
    const onReturn = vi.fn(async () => {})
    const listener = await open(onReturn)
    const responses = await Promise.allSettled([
      send(listener.returnUrl, `/auth/callback?code=${CODE}`),
      send(listener.returnUrl, `/auth/callback?code=${OTHER_CODE}`)
    ])
    const successful = responses.filter(
      (result) => result.status === 'fulfilled' && result.value.status === 200
    )
    expect(successful).toHaveLength(1)
    expect(onReturn).toHaveBeenCalledOnce()
  })

  it('같은 socket에 pipelining된 두 callback도 한 번만 전달한다', async () => {
    const onReturn = vi.fn(async () => {})
    const listener = await open(onReturn)
    const url = new URL(listener.returnUrl)
    const socket = connect(Number(url.port), '127.0.0.1')
    try {
      await once(socket, 'connect')
      const closed = once(socket, 'close')
      socket.resume()
      socket.write(
        `GET /auth/callback?code=${CODE} HTTP/1.1\r\nHost: ${url.host}\r\n\r\n` +
          `GET /auth/callback?code=${OTHER_CODE} HTTP/1.1\r\nHost: ${url.host}\r\n\r\n`
      )
      await closed
      expect(onReturn).toHaveBeenCalledExactlyOnceWith(`${listener.returnUrl}?code=${CODE}`)
    } finally {
      socket.destroy()
    }
  })

  it.each(['idle', 'partial-headers'] as const)(
    '취소는 %s 연결까지 닫고 반복 정리도 안전하다',
    async (stage) => {
      const controller = new AbortController()
      const onReturn = vi.fn(async () => {})
      const listener = await openLoopbackListener(controller.signal, onReturn)
      listeners.push(listener)
      const received = deferred<void>()
      currentServer().once('connection', (socket) => {
        socket.once('data', () => received.resolve())
      })
      const socket = connect(Number(new URL(listener.returnUrl).port), '127.0.0.1')
      try {
        await once(socket, 'connect')
        const closed = new Promise<void>((resolve) => socket.once('close', () => resolve()))
        socket.on('error', (error) => expect(error).toMatchObject({ code: 'ECONNRESET' }))
        if (stage === 'partial-headers') {
          socket.write(`GET /auth/callback?code=${CODE} HTTP/1.1\r\nHost: `)
          await received.promise
        }
        controller.abort()
        listener.close()
        await closed
        expect(currentServer().listening).toBe(false)
        await expect(send(listener.returnUrl, `/auth/callback?code=${CODE}`)).rejects.toThrow()
        expect(onReturn).not.toHaveBeenCalled()
      } finally {
        socket.destroy()
      }
    }
  )

  it.each(['before', 'during'] as const)(
    '열기 %s 취소는 수신기를 남기지 않는다',
    async (timing) => {
      const controller = new AbortController()
      if (timing === 'before') {
        controller.abort()
      }
      const opened = openLoopbackListener(controller.signal, vi.fn())
      controller.abort()
      await expect(opened).rejects.toThrow('Login return listener could not be opened.')
      expect(currentServer().listening).toBe(false)
    }
  )

  it('bind 실패는 raw 오류 없이 실패하고 다시 열지 않는다', async () => {
    const opened = openLoopbackListener(new AbortController().signal, vi.fn())
    currentServer().emit('error', new Error('synthetic bind failure'))
    await expect(opened).rejects.toThrow('Login return listener could not be opened.')
    expect(currentServer().listening).toBe(false)
    expect(createServer).toHaveBeenCalledOnce()
  })

  it.each([80, 1023, 65536])(
    'OS 포트 %i가 계약 범위 밖이면 수신기를 닫고 실패한다',
    async (port) => {
      const opened = openLoopbackListener(new AbortController().signal, vi.fn())
      vi.spyOn(currentServer(), 'address').mockReturnValue({
        address: '127.0.0.1',
        family: 'IPv4',
        port
      })
      await expect(opened).rejects.toThrow('Login return listener could not be opened.')
      expect(currentServer().listening).toBe(false)
    }
  )

  it.each(['0.0.0.0', '::1'])(
    'OS bind 주소 %s가 127.0.0.1이 아니면 수신기를 닫고 실패한다',
    async (address) => {
      const opened = openLoopbackListener(new AbortController().signal, vi.fn())
      const family = address === '::1' ? 'IPv6' : 'IPv4'
      vi.spyOn(currentServer(), 'address').mockReturnValue({ address, family, port: 49152 })
      await expect(opened).rejects.toThrow('Login return listener could not be opened.')
      expect(currentServer().listening).toBe(false)
    }
  )
})

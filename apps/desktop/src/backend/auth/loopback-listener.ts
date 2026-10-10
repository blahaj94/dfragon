import { createServer } from 'node:http'
import type { Socket } from 'node:net'
import { LOGIN_COMPLETE_HTML } from './login-complete-page'
import { formatLoopbackReturnUrl, parseReturnUrl, validateLoopbackReturnUrl } from './protocol'
import type { AuthLoopback } from './types'

// 브라우저는 127.0.0.1의 cookie를 포트와 무관하게 보내므로 Node 기본 상한을 유지한다.
const MAX_LOOPBACK_HEADER_BYTES = 16_384
const LOOPBACK_SOCKET_IDLE_TIMEOUT_MS = 5_000

export const openLoopbackListener: AuthLoopback['open'] = (signal, onReturn) => {
  return new Promise((resolve, reject) => {
    const sockets = new Set<Socket>()
    let returnUrl: string | null = null
    let completionSocket: Socket | null = null
    let closed = false
    const server = createServer(
      { maxHeaderSize: MAX_LOOPBACK_HEADER_BYTES },
      (request, response) => {
        response.setHeader('Connection', 'close')
        response.setHeader('Cache-Control', 'no-store')
        response.setHeader('Referrer-Policy', 'no-referrer')
        response.setHeader('X-Content-Type-Options', 'nosniff')
        response.setHeader(
          'Content-Security-Policy',
          "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
        )
        const remoteAddress = request.socket.remoteAddress
        const isLoopback = remoteAddress === '127.0.0.1' || remoteAddress === '::ffff:127.0.0.1'
        if (!isLoopback) {
          response.writeHead(403).end()

          return
        }

        if (closed || returnUrl == null || request.method !== 'GET') {
          response.writeHead(404).end()

          return
        }
        const origin = new URL(returnUrl).origin
        const raw = `${origin}${request.url ?? ''}`
        try {
          if (request.headers.host !== new URL(returnUrl).host) {
            response.writeHead(404).end()

            return
          }
          parseReturnUrl(raw, returnUrl)
        } catch {
          response.writeHead(404).end()

          return
        }

        completionSocket = request.socket
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end(LOGIN_COMPLETE_HTML)
        close()
        // Exchange completion is independent of the browser reading its response.
        try {
          void onReturn(raw).catch(() => undefined)
        } catch {
          // The listener is already closed; raw callback failures must not escape HTTP ingress.
        }
      }
    )

    function close(): void {
      if (closed) {
        return
      }
      closed = true
      signal.removeEventListener('abort', fail)
      server.close()
      for (const socket of sockets) {
        if (socket !== completionSocket) {
          socket.destroy()
        }
      }
    }

    function fail(): void {
      close()
      reject(new Error('Login return listener could not be opened.'))
    }

    server.on('connection', (socket) => {
      sockets.add(socket)
      socket.setTimeout(LOOPBACK_SOCKET_IDLE_TIMEOUT_MS, () => socket.destroy())
      socket.once('close', () => sockets.delete(socket))
      if (closed) {
        socket.destroy()
      }
    })
    server.on('error', fail)
    signal.addEventListener('abort', fail, { once: true })
    if (signal.aborted) {
      fail()

      return
    }
    try {
      server.listen(0, '127.0.0.1', () => {
        // Cancellation can win while listen is still waiting for its callback.
        if (closed) {
          server.close()

          return
        }
        const address = server.address()
        if (address == null || typeof address === 'string' || address.address !== '127.0.0.1') {
          fail()

          return
        }
        try {
          returnUrl = validateLoopbackReturnUrl(formatLoopbackReturnUrl(address.port))
        } catch {
          fail()

          return
        }
        resolve({ returnUrl, close })
      })
    } catch {
      fail()
    }
  })
}

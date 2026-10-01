import type { Request, Response } from 'express'
import { getIpQuotaKey } from '@dfragon/lib/utils/ip-quota-key'
import { LOGIN_ERRORS } from '../../constants/login.js'
import { LoginFailure } from '../../errors/login.js'
import { jsonError } from './json-parser.js'

export const AUTH_ADMISSION = {
  windowMs: 60_000,
  perClient: 120,
  total: 1200,
  concurrent: 32
} as const

/** Hold capacity until the service settles, including after an HTTP disconnect. */
export class AuthCapacity {
  private active = 0

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= AUTH_ADMISSION.concurrent) {
      throw new LoginFailure(LOGIN_ERRORS.RATE_LIMIT)
    }
    this.active++
    try {

      return await work()
    } finally {
      this.active--
    }
  }
}

export function createAuthRateLimit() {
  const clients = new Map<string, number>()
  let window = { until: 0, count: 0 }

  return (request: Request, response: Response, next: () => void) => {
    const path = request.path.toLowerCase().replace(/\/+$/, '')
    const accountRead = request.method === 'GET' && path === '/me'
    const limited =
      (request.method === 'POST' &&
        (['/auth/login-requests', '/auth/exchange', '/auth/refresh', '/auth/logout'].includes(
          path
        ) ||
          path.startsWith('/auth/passkeys/'))) ||
      (request.method === 'GET' &&
        ['/auth/login/authorize', '/auth/login/phone', '/auth/passkeys/manage', '/me'].includes(
          path
        )) ||
      (request.method === 'PATCH' && path === '/me/nickname')
    if (!limited) {
      next()

      return
    }
    const now = Date.now()
    if (now >= window.until) {
      window = { until: now + AUTH_ADMISSION.windowMs, count: 0 }
      clients.clear()
    }
    let client = 'unknown'
    if (!accountRead) {
      client = getIpQuotaKey(request.ip ?? request.socket.remoteAddress ?? '')
    }
    const count = clients.get(client) ?? 0
    if (
      (!accountRead && count >= AUTH_ADMISSION.perClient) ||
      window.count >= AUTH_ADMISSION.total
    ) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil((window.until - now) / 1000))))
      response.setHeader('Cache-Control', 'no-store')
      jsonError(response, LOGIN_ERRORS.RATE_LIMIT)

      return
    }
    // OCR verifies every image through /me from one server IP; reads retain the shared ceiling.
    if (!accountRead) {
      clients.set(client, count + 1)
    }
    window.count++
    next()
  }
}

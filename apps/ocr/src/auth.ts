import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { OcrError } from './errors.js'
import {
  parseAuthenticatedUser,
  parseCreatedLogin,
  parseLoginTokens,
  parseSessionTokens
} from './auth-responses.js'
import type { LoginTokens } from './auth-responses.js'

export type AuthConfiguration = { origin: string; authOrigin: string; ownerId: string }
type Session = { tokens: LoginTokens; expires: number; active: boolean; refresh?: Promise<void> }
type PendingLogin = { requestId: string; verifier: string; expires: number }
type AuthRequestOptions = { body?: unknown; accessToken?: string }

const sessionCookie = '__Host-ocr-session'
const pendingCookie = '__Host-ocr-login'

function createOpaqueToken(): string {
  return randomBytes(32).toString('base64url')
}

function readCookie(request: Request, name: string): string | undefined {
  const values = (request.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`))
  if (values.length !== 1) {
    return undefined
  }
  const value = values[0].slice(name.length + 1)
  return value.length === 0 ? undefined : value
}

function setCookie(response: Response, name: string, value: string, maxAge: number) {
  response.append(
    'Set-Cookie',
    `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
  )
}

export class OcrAuth {
  private readonly pending = new Map<string, PendingLogin>()
  private readonly sessions = new Map<string, Session>()

  constructor(
    private readonly config: AuthConfiguration,
    private readonly request: typeof fetch = fetch
  ) {}

  private async requestAuthentication(
    path: string,
    { body, accessToken }: AuthRequestOptions = {}
  ): Promise<unknown> {
    let response: globalThis.Response
    try {
      response = await this.request(`${this.config.authOrigin}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(accessToken === undefined ? {} : { Authorization: `Bearer ${accessToken}` })
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      })
    } catch {
      throw new OcrError('AUTH_UNAVAILABLE')
    }

    if (!response.ok) {
      throw new OcrError(response.status === 401 ? 'LOGIN_REQUIRED' : 'AUTH_UNAVAILABLE')
    }
    if (response.status === 204) {
      return null
    }

    try {
      return await response.json()
    } catch {
      throw new OcrError('AUTH_UNAVAILABLE')
    }
  }

  private removeExpiredEntries() {
    const now = Date.now()
    for (const [key, pending] of this.pending) {
      if (pending.expires <= now) {
        this.pending.delete(key)
      }
    }
    for (const [key, session] of this.sessions) {
      if (session.expires <= now) {
        session.active = false
        this.sessions.delete(key)
        void this.revokeSession(session.tokens.refreshToken)
      }
    }
  }

  private async revokeSession(refreshToken: string) {
    try {
      await this.requestAuthentication('/auth/logout', { body: { refreshToken } })
    } catch {
      // OCR 접근은 먼저 제거한다. 인증 서버 연결 실패 시 기존 세션의 자체 만료는 유지된다.
    }
  }

  async begin(request: Request, response: Response) {
    this.removeExpiredEntries()
    if (this.pending.size >= 100) {
      throw new OcrError('LOGIN_LIMIT')
    }

    const previousBinding = readCookie(request, pendingCookie)
    if (previousBinding !== undefined) {
      this.pending.delete(previousBinding)
    }
    const verifier = createOpaqueToken()
    const loginResponse = await this.requestAuthentication('/auth/login-requests', {
      body: {
        provider: 'passkey',
        clientId: 'ocr',
        codeChallenge: createHash('sha256').update(verifier).digest('base64url'),
        codeChallengeMethod: 'S256'
      }
    })
    const login = parseCreatedLogin(loginResponse)
    const target = new URL(login.browserUrl)
    if (target.origin !== this.config.authOrigin || target.pathname !== '/auth/login/authorize') {
      throw new OcrError('AUTH_UNAVAILABLE')
    }

    const binding = createOpaqueToken()
    this.pending.set(binding, {
      requestId: login.requestId,
      verifier,
      expires: Math.min(Date.now() + 600_000, Date.parse(login.expiresAt))
    })
    setCookie(response, pendingCookie, binding, 600)
    response.json({ url: target.href })
  }

  async callback(request: Request, response: Response) {
    this.removeExpiredEntries()
    const binding = readCookie(request, pendingCookie)
    const pending = binding === undefined ? undefined : this.pending.get(binding)
    const query = new URL(request.originalUrl, this.config.origin).searchParams
    const code = query.get('code')
    if (
      binding === undefined ||
      pending === undefined ||
      query.size !== 1 ||
      code === null ||
      !/^[A-Za-z0-9_-]{43}$/.test(code)
    ) {
      throw new OcrError('LOGIN_INVALID')
    }

    this.pending.delete(binding)
    setCookie(response, pendingCookie, '', 0)
    const exchangeResponse = await this.requestAuthentication('/auth/exchange', {
      body: { requestId: pending.requestId, clientId: 'ocr', code, codeVerifier: pending.verifier }
    })
    const tokens = parseLoginTokens(exchangeResponse)
    if (tokens.user.id !== this.config.ownerId) {
      await this.revokeSession(tokens.refreshToken)
      throw new OcrError('OWNER_REQUIRED')
    }

    const previousId = readCookie(request, sessionCookie)
    if (previousId !== undefined) {
      const previousSession = this.sessions.get(previousId)
      if (previousSession !== undefined) {
        previousSession.active = false
        this.sessions.delete(previousId)
        await this.revokeSession(previousSession.tokens.refreshToken)
      }
    }
    if (this.sessions.size >= 20) {
      await this.revokeSession(tokens.refreshToken)
      throw new OcrError('LOGIN_LIMIT')
    }

    const id = createOpaqueToken()
    this.sessions.set(id, { tokens, active: true, expires: Date.now() + 8 * 3600_000 })
    setCookie(response, sessionCookie, id, 8 * 3600)
    response.redirect(303, '/')
  }

  async require(request: Request) {
    this.removeExpiredEntries()
    const id = readCookie(request, sessionCookie)
    const session = id === undefined ? undefined : this.sessions.get(id)
    if (session === undefined || !session.active) {
      throw new OcrError('LOGIN_REQUIRED')
    }

    if (Date.parse(session.tokens.accessTokenExpiresAt) <= Date.now() + 30_000) {
      if (session.refresh === undefined) {
        session.refresh = (async () => {
          const refreshResponse = await this.requestAuthentication('/auth/refresh', {
            body: { refreshToken: session.tokens.refreshToken }
          })
          const next = parseSessionTokens(refreshResponse)
          session.tokens = { ...session.tokens, ...next }
          if (!session.active) {
            await this.revokeSession(next.refreshToken)
            throw new OcrError('LOGIN_REQUIRED')
          }
        })()
          .catch((error) => {
            session.active = false
            throw error
          })
          .finally(() => {
            session.refresh = undefined
          })
      }
      await session.refresh
    }

    const profileResponse = await this.requestAuthentication('/me', {
      accessToken: session.tokens.accessToken
    })
    const user = parseAuthenticatedUser(profileResponse)
    if (!session.active || user.id !== this.config.ownerId) {
      throw new OcrError('OWNER_REQUIRED')
    }
    return user
  }

  async logout(request: Request, response: Response) {
    const id = readCookie(request, sessionCookie)
    if (id !== undefined) {
      const session = this.sessions.get(id)
      if (session !== undefined) {
        session.active = false
        this.sessions.delete(id)
        await this.revokeSession(session.tokens.refreshToken)
      }
    }

    setCookie(response, sessionCookie, '', 0)
    response.status(204).end()
  }

  async close() {
    const sessions = [...this.sessions.values()]
    this.sessions.clear()
    this.pending.clear()
    for (const session of sessions) {
      session.active = false
    }
    await Promise.allSettled(
      sessions.map((session) => this.revokeSession(session.tokens.refreshToken))
    )
  }
}

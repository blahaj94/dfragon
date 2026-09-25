import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { OCR_ERROR_CODE, OcrError } from './errors.js'
import {
  parseAuthenticatedUser,
  parseCreatedLogin,
  parseLoginTokens,
  parseSessionTokens
} from './auth-responses.js'
import { OCR_AUTH } from './constants.js'
import type { LoginTokens } from './auth-responses.js'

const BEARER_JWT_PATTERN = /^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

export type AuthConfiguration = { origin: string; authOrigin: string; ownerId: string }
type Session = { tokens: LoginTokens; expires: number; active: boolean; refresh?: Promise<void> }
type PendingLogin = { requestId: string; verifier: string; expires: number }
type AuthRequestOptions = { body?: unknown; accessToken?: string }

function createOpaqueToken(): string {
  return randomBytes(OCR_AUTH.opaqueBytes).toString('base64url')
}

function readCookie(request: Request, name: string): string | undefined {
  const value: unknown = request.cookies?.[name]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export class OcrAuth {
  private inFlightLogins = 0
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
        signal: AbortSignal.timeout(OCR_AUTH.requestTimeoutMs),
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(accessToken === undefined ? {} : { Authorization: `Bearer ${accessToken}` })
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      })
    } catch {
      throw new OcrError(OCR_ERROR_CODE.AUTH_UNAVAILABLE)
    }

    if (!response.ok) {
      throw new OcrError(
        response.status === 401 ? OCR_ERROR_CODE.LOGIN_REQUIRED : OCR_ERROR_CODE.AUTH_UNAVAILABLE
      )
    }
    if (response.status === 204) {
      return null
    }

    try {
      return await response.json()
    } catch {
      throw new OcrError(OCR_ERROR_CODE.AUTH_UNAVAILABLE)
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
    if (this.pending.size + this.inFlightLogins >= OCR_AUTH.maximumPendingLogins) {
      throw new OcrError(OCR_ERROR_CODE.LOGIN_LIMIT)
    }

    // 인증 API를 기다리는 요청도 한도에 포함하고 실패 시 즉시 반환한다.
    this.inFlightLogins++
    try {
      const previousBinding = readCookie(request, OCR_AUTH.pendingCookie)
      if (previousBinding !== undefined) {
        this.pending.delete(previousBinding)
      }
      const verifier = createOpaqueToken()
      const loginResponse = await this.requestAuthentication('/auth/login-requests', {
        body: {
          provider: 'passkey',
          clientId: OCR_AUTH.clientId,
          codeChallenge: createHash('sha256').update(verifier).digest('base64url'),
          codeChallengeMethod: 'S256'
        }
      })
      const login = parseCreatedLogin(loginResponse)
      const target = new URL(login.browserUrl)
      if (target.origin !== this.config.authOrigin || target.pathname !== '/auth/login/authorize') {
        throw new OcrError(OCR_ERROR_CODE.AUTH_UNAVAILABLE)
      }

      const binding = createOpaqueToken()
      this.pending.set(binding, {
        requestId: login.requestId,
        verifier,
        expires: Math.min(Date.now() + OCR_AUTH.pendingLifetimeMs, Date.parse(login.expiresAt))
      })
      response.cookie(OCR_AUTH.pendingCookie, binding, {
        ...OCR_AUTH.cookieOptions,
        maxAge: OCR_AUTH.pendingLifetimeMs
      })
      response.json({ url: target.href })
    } finally {
      this.inFlightLogins--
    }
  }

  async callback(request: Request, response: Response) {
    this.removeExpiredEntries()
    const binding = readCookie(request, OCR_AUTH.pendingCookie)
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
      throw new OcrError(OCR_ERROR_CODE.LOGIN_INVALID)
    }

    this.pending.delete(binding)
    response.clearCookie(OCR_AUTH.pendingCookie, OCR_AUTH.cookieOptions)
    const exchangeResponse = await this.requestAuthentication('/auth/exchange', {
      body: {
        requestId: pending.requestId,
        clientId: OCR_AUTH.clientId,
        code,
        codeVerifier: pending.verifier
      }
    })
    const tokens = parseLoginTokens(exchangeResponse)
    if (tokens.user.id !== this.config.ownerId) {
      await this.revokeSession(tokens.refreshToken)
      throw new OcrError(OCR_ERROR_CODE.OWNER_REQUIRED)
    }

    const previousId = readCookie(request, OCR_AUTH.sessionCookie)
    if (previousId !== undefined) {
      const previousSession = this.sessions.get(previousId)
      if (previousSession !== undefined) {
        previousSession.active = false
        this.sessions.delete(previousId)
        await this.revokeSession(previousSession.tokens.refreshToken)
      }
    }
    if (this.sessions.size >= OCR_AUTH.maximumSessions) {
      await this.revokeSession(tokens.refreshToken)
      throw new OcrError(OCR_ERROR_CODE.LOGIN_LIMIT)
    }

    const id = createOpaqueToken()
    this.sessions.set(id, {
      tokens,
      active: true,
      expires: Date.now() + OCR_AUTH.sessionLifetimeMs
    })
    response.cookie(OCR_AUTH.sessionCookie, id, {
      ...OCR_AUTH.cookieOptions,
      maxAge: OCR_AUTH.sessionLifetimeMs
    })
    response.redirect(303, '/')
  }

  async requireDesktopOwner(request: Request) {
    const authorization = request.headers.authorization
    if (
      typeof authorization !== 'string' ||
      authorization.length > 8199 ||
      !BEARER_JWT_PATTERN.test(authorization)
    ) {
      throw new OcrError(OCR_ERROR_CODE.LOGIN_REQUIRED)
    }
    // The existing API checks the JWT and live session. Desktop tokens never mint OCR cookies.
    const response = await this.requestAuthentication('/me', {
      accessToken: authorization.slice(7)
    })
    if (parseAuthenticatedUser(response).id !== this.config.ownerId) {
      throw new OcrError(OCR_ERROR_CODE.OWNER_REQUIRED)
    }
  }

  async require(request: Request) {
    this.removeExpiredEntries()
    const id = readCookie(request, OCR_AUTH.sessionCookie)
    const session = id === undefined ? undefined : this.sessions.get(id)
    if (session === undefined || !session.active) {
      throw new OcrError(OCR_ERROR_CODE.LOGIN_REQUIRED)
    }

    if (Date.parse(session.tokens.accessTokenExpiresAt) <= Date.now() + OCR_AUTH.refreshMarginMs) {
      if (session.refresh === undefined) {
        session.refresh = (async () => {
          const refreshResponse = await this.requestAuthentication('/auth/refresh', {
            body: { refreshToken: session.tokens.refreshToken }
          })
          const next = parseSessionTokens(refreshResponse)
          session.tokens = { ...session.tokens, ...next }
          if (!session.active) {
            await this.revokeSession(next.refreshToken)
            throw new OcrError(OCR_ERROR_CODE.LOGIN_REQUIRED)
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
      throw new OcrError(OCR_ERROR_CODE.OWNER_REQUIRED)
    }
    return user
  }

  async logout(request: Request, response: Response) {
    const id = readCookie(request, OCR_AUTH.sessionCookie)
    if (id !== undefined) {
      const session = this.sessions.get(id)
      if (session !== undefined) {
        session.active = false
        this.sessions.delete(id)
        await this.revokeSession(session.tokens.refreshToken)
      }
    }

    response.clearCookie(OCR_AUTH.sessionCookie, OCR_AUTH.cookieOptions)
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

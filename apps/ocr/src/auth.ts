import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import { getIpQuotaKey } from '@dfragon/lib/utils/ip-quota-key'
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
const SYNTHETIC_UPLOAD_TOKEN_PATTERN = /^Bearer [A-Za-z0-9_-]{43,128}$/

export function parseSyntheticUploadTokenSha256(value: string | undefined): string | undefined {
  if (value !== undefined && (value.length !== 64 || !/^[0-9a-f]{64}$/.test(value))) {
    throw new Error('Invalid OCR configuration')
  }
  return value
}

export function isSyntheticUploadRequest(request: Request): boolean {
  return request.method === 'POST' && request.originalUrl === '/api/synthetic-samples'
}

export type AuthConfiguration = {
  origin: string
  authOrigin: string
  ownerId: string
  trustedProxyHops?: 1
  syntheticUploadTokenSha256?: string
}
type Session = { tokens: LoginTokens; expires: number; active: boolean; refresh?: Promise<void> }
type PendingLogin = { requestId: string; verifier: string; expires: number; client: string }
type AuthRequestOptions = { body?: unknown; accessToken?: string }

function createOpaqueToken(): string {
  return randomBytes(OCR_AUTH.opaqueBytes).toString('base64url')
}

function readCookie(request: Request, name: string): string | undefined {
  const value: unknown = request.cookies?.[name]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export class OcrAuth {
  private closed = false
  private readonly inFlightLogins = new Map<string, number>()
  private readonly attempts = new Map<string, number>()
  private attemptWindow = { until: 0, count: 0 }
  private readonly pending = new Map<string, PendingLogin>()
  private readonly sessions = new Map<string, Session>()
  private readonly syntheticUploadTokenDigest: Buffer | undefined

  constructor(
    private readonly config: AuthConfiguration,
    private readonly request: typeof fetch = fetch
  ) {
    const digest = parseSyntheticUploadTokenSha256(config.syntheticUploadTokenSha256)
    this.syntheticUploadTokenDigest = digest === undefined ? undefined : Buffer.from(digest, 'hex')
  }

  requireSyntheticUpload(request: Request) {
    const authorization = request.headers.authorization
    if (
      this.syntheticUploadTokenDigest === undefined ||
      typeof authorization !== 'string' ||
      !SYNTHETIC_UPLOAD_TOKEN_PATTERN.test(authorization) ||
      !timingSafeEqual(
        createHash('sha256').update(authorization.slice(7)).digest(),
        this.syntheticUploadTokenDigest
      )
    ) {
      throw new OcrError(OCR_ERROR_CODE.UPLOAD_TOKEN_REQUIRED)
    }
  }

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
    if (this.closed) {
      throw new OcrError(OCR_ERROR_CODE.AUTH_UNAVAILABLE)
    }
    const client = getIpQuotaKey(request.ip ?? request.socket?.remoteAddress ?? '')
    const now = Date.now()
    if (now >= this.attemptWindow.until) {
      this.attemptWindow = { until: now + OCR_AUTH.loginWindowMs, count: 0 }
      this.attempts.clear()
    }
    const attempts = this.attempts.get(client) ?? 0
    if (
      attempts >= OCR_AUTH.maximumLoginAttemptsPerClient ||
      this.attemptWindow.count >= OCR_AUTH.maximumLoginAttempts
    ) {
      throw new OcrError(OCR_ERROR_CODE.LOGIN_LIMIT)
    }
    const previousBinding = readCookie(request, OCR_AUTH.pendingCookie)
    const previous = previousBinding === undefined ? undefined : this.pending.get(previousBinding)
    const inFlight = this.inFlightLogins.get(client) ?? 0
    const clientPending = [...this.pending.values()].filter(
      (login) => login.client === client
    ).length
    const replacesClientPending = previous?.client === client ? 1 : 0
    const totalInFlight = [...this.inFlightLogins.values()].reduce((sum, count) => sum + count, 0)
    if (
      clientPending + inFlight - replacesClientPending >= OCR_AUTH.maximumPendingLoginsPerClient ||
      this.pending.size + totalInFlight - (previous ? 1 : 0) >= OCR_AUTH.maximumPendingLogins
    ) {
      throw new OcrError(OCR_ERROR_CODE.LOGIN_LIMIT)
    }
    this.attempts.set(client, attempts + 1)
    this.attemptWindow.count++
    if (previousBinding !== undefined) {
      this.pending.delete(previousBinding)
    }

    // 인증 API를 기다리는 요청도 한도에 포함하고 실패 시 즉시 반환한다.
    this.inFlightLogins.set(client, inFlight + 1)
    try {
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
      if (this.closed) {
        throw new OcrError(OCR_ERROR_CODE.AUTH_UNAVAILABLE)
      }
      const target = new URL(login.browserUrl)
      if (target.origin !== this.config.authOrigin || target.pathname !== '/auth/login/authorize') {
        throw new OcrError(OCR_ERROR_CODE.AUTH_UNAVAILABLE)
      }

      const binding = createOpaqueToken()
      this.pending.set(binding, {
        requestId: login.requestId,
        verifier,
        client,
        expires: Math.min(Date.now() + OCR_AUTH.pendingLifetimeMs, Date.parse(login.expiresAt))
      })
      response.cookie(OCR_AUTH.pendingCookie, binding, {
        ...OCR_AUTH.cookieOptions,
        maxAge: OCR_AUTH.pendingLifetimeMs
      })
      response.json({ url: target.href })
    } finally {
      const remaining = this.inFlightLogins.get(client)! - 1
      if (remaining === 0) {
        this.inFlightLogins.delete(client)
      } else {
        this.inFlightLogins.set(client, remaining)
      }
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
    this.closed = true
    const sessions = [...this.sessions.values()]
    this.sessions.clear()
    this.pending.clear()
    this.attempts.clear()
    for (const session of sessions) {
      session.active = false
    }
    await Promise.allSettled(
      sessions.map((session) => this.revokeSession(session.tokens.refreshToken))
    )
  }
}

import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { createHash } from 'node:crypto'
import type { CookieOptions, Request, Response } from 'express'
import { OcrAuth } from '../src/auth.js'

const origin = 'https://ocr.example.test'
const authOrigin = 'https://auth.example.test'
const ownerId = '00000000-0000-4000-8000-000000000001'
const pendingCookie = '__Host-ocr-login'
const sessionCookie = '__Host-ocr-session'

function gate() {
  let resolve!: () => void
  const promise = new Promise<void>((release) => {
    resolve = release
  })

  return { promise, resolve }
}

function responseRecorder() {
  const cookies: { name: string; value: string; options: CookieOptions }[] = []
  const cleared: string[] = []
  let redirect: { status: number; path: string } | undefined
  const response = {
    cookie(name: string, value: string, options: CookieOptions) {
      cookies.push({ name, value, options })
    },
    clearCookie(name: string) {
      cleared.push(name)
    },
    json() {},
    redirect(status: number, path: string) {
      redirect = { status, path }
    },
    status() {
      return { end() {} }
    }
  } as unknown as Response

  return { response, cookies, cleared, getRedirect: () => redirect }
}

function authenticationFixture(
  t: TestContext,
  options: {
    expired?: boolean
    identity?: string
    beforeExchange?: () => Promise<void>
    beforeRefresh?: () => Promise<void>
    beforeMe?: () => Promise<void>
  } = {}
) {
  const calls: { path: string; body?: Record<string, unknown>; authorization: string | null }[] = []
  const request: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname
    const body = init?.body === undefined ? undefined : JSON.parse(String(init.body))
    const authorization = new Headers(init?.headers).get('authorization')
    calls.push({ path, body, authorization })
    if (path === '/auth/login-requests') {
      return globalThis.Response.json({
        requestId: '00000000-0000-4000-8000-000000000002',
        browserUrl: `${authOrigin}/auth/login/authorize?ticket=fixture`,
        expiresAt: new Date(Date.now() + 600_000).toISOString()
      })
    }

    if (path === '/auth/exchange') {
      await options.beforeExchange?.()
      const remaining = options.expired ? -1000 : 900_000

      return globalThis.Response.json({
        accessToken: 'owner.access.signature',
        accessTokenExpiresAt: new Date(Date.now() + remaining).toISOString(),
        refreshToken: 'initial-refresh',
        user: { id: options.identity ?? ownerId, nickname: '검증계정' }
      })
    }

    if (path === '/auth/refresh') {
      assert.equal(body?.refreshToken, 'initial-refresh')
      await options.beforeRefresh?.()

      return globalThis.Response.json({
        accessToken: 'rotated.access.signature',
        accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
        refreshToken: 'rotated-refresh'
      })
    }

    if (path === '/me') {
      assert(
        ['Bearer owner.access.signature', 'Bearer rotated.access.signature'].includes(
          authorization!
        )
      )
      await options.beforeMe?.()

      return globalThis.Response.json({
        user: { id: options.identity ?? ownerId, nickname: '검증계정' }
      })
    }

    if (path === '/auth/logout') {
      return new globalThis.Response(null, { status: 204 })
    }
    throw new Error('예상하지 않은 인증 요청')
  }
  const auth = new OcrAuth({ origin, authOrigin, ownerId }, request)
  t.after(() => auth.close())
  const loginRequest = () => ({ ip: '192.0.2.1', cookies: {} }) as unknown as Request
  const callbackRequest = (binding: string, query = `code=${'A'.repeat(43)}`) =>
    ({
      originalUrl: `/auth/callback?${query}`,
      cookies: { [pendingCookie]: binding }
    }) as unknown as Request
  async function begin() {
    const recorder = responseRecorder()
    await auth.begin(loginRequest(), recorder.response)
    assert.equal(recorder.cookies.length, 1)

    return recorder.cookies[0].value
  }
  async function login() {
    const binding = await begin()
    const recorder = responseRecorder()
    await auth.callback(callbackRequest(binding), recorder.response)
    const session = recorder.cookies.find(({ name }) => name === sessionCookie)
    assert(session)
    const protectedRequest = { cookies: { [sessionCookie]: session.value } } as unknown as Request

    return { binding, recorder, protectedRequest }
  }

  return { auth, calls, begin, login, callbackRequest }
}

test('callback은 요청 쿠키와 PKCE를 묶고 유효한 code를 한 번만 교환한다', async (t) => {
  const f = authenticationFixture(t)
  const binding = await f.begin()
  for (const query of [
    '',
    'code=short',
    `code=${'A'.repeat(43)}%0A`,
    `code=${'A'.repeat(43)}%0D`,
    `code=${'A'.repeat(43)}&code=${'B'.repeat(43)}`,
    `code=${'A'.repeat(43)}&extra=1`
  ]) {
    await assert.rejects(
      f.auth.callback(f.callbackRequest(binding, query), responseRecorder().response),
      { code: 'LOGIN_INVALID' }
    )
  }
  await assert.rejects(f.auth.callback(f.callbackRequest('unknown'), responseRecorder().response), {
    code: 'LOGIN_INVALID'
  })
  assert.deepEqual(
    f.calls.map(({ path }) => path),
    ['/auth/login-requests']
  )
  const recorder = responseRecorder()
  await f.auth.callback(f.callbackRequest(binding), recorder.response)
  const start = f.calls.find(({ path }) => path === '/auth/login-requests')!.body!
  const exchange = f.calls.find(({ path }) => path === '/auth/exchange')!.body!
  assert.equal(start.clientId, 'ocr')
  assert.equal(start.codeChallengeMethod, 'S256')
  assert.equal(exchange.clientId, 'ocr')
  assert.equal(exchange.requestId, '00000000-0000-4000-8000-000000000002')
  assert.equal(exchange.code, 'A'.repeat(43))
  assert.equal(
    createHash('sha256').update(String(exchange.codeVerifier)).digest('base64url'),
    start.codeChallenge
  )
  assert.deepEqual(recorder.cleared, [pendingCookie])
  assert.deepEqual(recorder.getRedirect(), { status: 303, path: '/' })
  assert.equal(recorder.cookies.length, 1)
  assert.equal(recorder.cookies[0].name, sessionCookie)
  assert.deepEqual(recorder.cookies[0].options, {
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60_000
  })
  await assert.rejects(f.auth.callback(f.callbackRequest(binding), responseRecorder().response), {
    code: 'LOGIN_INVALID'
  })
  assert.equal(f.calls.filter(({ path }) => path === '/auth/exchange').length, 1)
})

test('다른 계정의 callback은 받은 upstream 세션을 폐기하고 OCR 쿠키를 발급하지 않는다', async (t) => {
  const f = authenticationFixture(t, { identity: '00000000-0000-4000-8000-000000000003' })
  const binding = await f.begin()
  const recorder = responseRecorder()
  await assert.rejects(f.auth.callback(f.callbackRequest(binding), recorder.response), {
    code: 'OWNER_REQUIRED'
  })
  assert.deepEqual(recorder.cookies, [])
  assert.equal(recorder.getRedirect(), undefined)
  assert.deepEqual(
    f.calls.filter(({ path }) => path === '/auth/logout').map(({ body }) => body),
    [{ refreshToken: 'initial-refresh' }]
  )
})

test('동시 callback은 진행 중 교환이 끝나기 전에도 같은 요청을 다시 소비하지 못한다', async (t) => {
  const entered = gate()
  const release = gate()
  const f = authenticationFixture(t, {
    beforeExchange: async () => {
      entered.resolve()
      await release.promise
    }
  })
  t.after(() => release.resolve())
  const binding = await f.begin()
  const recorder = responseRecorder()
  const first = f.auth.callback(f.callbackRequest(binding), recorder.response)
  await entered.promise
  await assert.rejects(f.auth.callback(f.callbackRequest(binding), responseRecorder().response), {
    code: 'LOGIN_INVALID'
  })
  release.resolve()
  await first
  assert.equal(f.calls.filter(({ path }) => path === '/auth/exchange').length, 1)
  assert.equal(recorder.cookies.length, 1)
})

test('로그아웃 중 완료된 단일 refresh는 회전된 토큰도 폐기하고 대기 요청을 거절한다', async (t) => {
  const entered = gate()
  const release = gate()
  const f = authenticationFixture(t, {
    expired: true,
    beforeRefresh: async () => {
      entered.resolve()
      await release.promise
    }
  })
  t.after(() => release.resolve())
  const { protectedRequest } = await f.login()
  const first = f.auth.require(protectedRequest)
  const second = f.auth.require(protectedRequest)
  const results = Promise.allSettled([first, second])
  await entered.promise
  await f.auth.logout(protectedRequest, responseRecorder().response)
  release.resolve()
  for (const result of await results) {
    assert.equal(result.status, 'rejected')
    if (result.status === 'rejected') {
      assert.equal(result.reason.code, 'LOGIN_REQUIRED')
    }
  }
  assert.equal(f.calls.filter(({ path }) => path === '/auth/refresh').length, 1)
  assert.equal(f.calls.filter(({ path }) => path === '/me').length, 0)
  assert.deepEqual(
    f.calls
      .filter(({ path }) => path === '/auth/logout')
      .map(({ body }) => body?.refreshToken)
      .sort(),
    ['initial-refresh', 'rotated-refresh']
  )
  await assert.rejects(f.auth.require(protectedRequest), { code: 'LOGIN_REQUIRED' })
})

test('로그아웃 이후 늦게 도착한 활성 계정 응답으로 폐기된 세션에 접근하지 못한다', async (t) => {
  const entered = gate()
  const release = gate()
  const f = authenticationFixture(t, {
    beforeMe: async () => {
      entered.resolve()
      await release.promise
    }
  })
  t.after(() => release.resolve())
  const { protectedRequest } = await f.login()
  const pending = f.auth.require(protectedRequest)
  const rejection = assert.rejects(pending, { code: 'LOGIN_REQUIRED' })
  await entered.promise
  await f.auth.logout(protectedRequest, responseRecorder().response)
  release.resolve()
  await rejection
  await assert.rejects(f.auth.require(protectedRequest), { code: 'LOGIN_REQUIRED' })
})

test('서버 인증 종료 이후 늦게 끝난 callback은 새 쿠키 없이 받은 세션을 폐기한다', async (t) => {
  const entered = gate()
  const release = gate()
  const f = authenticationFixture(t, {
    beforeExchange: async () => {
      entered.resolve()
      await release.promise
    }
  })
  t.after(() => release.resolve())
  const binding = await f.begin()
  const recorder = responseRecorder()
  const pending = f.auth.callback(f.callbackRequest(binding), recorder.response)
  const rejection = assert.rejects(pending, { code: 'AUTH_UNAVAILABLE' })
  await entered.promise
  await f.auth.close()
  release.resolve()
  await rejection
  assert.deepEqual(recorder.cookies, [])
  assert.equal(recorder.getRedirect(), undefined)
  assert.deepEqual(
    f.calls.filter(({ path }) => path === '/auth/logout').map(({ body }) => body),
    [{ refreshToken: 'initial-refresh' }]
  )
})
